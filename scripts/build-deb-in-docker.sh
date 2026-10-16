#!/usr/bin/env bash
# Build the fork's Linux .deb inside Docker (no host pnpm or build toolchain needed).
#
# Usage: scripts/build-deb-in-docker.sh
# Needs: node_modules installed in the worktree (ORCA_PNPM_GLOBAL_VIRTUAL_STORE=0 on the host), and
# host node plus Docker for the Wayland clipboard helper step. The cc-tabdiff binary already in
# resources/cc-tabdiff/linux-x64 is packaged as is (the image has no Go). Electron and
# electron-builder downloads live in the `orca-deb-cache` volume. Output: dist/orca-ide_<ver>_amd64.deb
# The rpm target fails afterwards ("Need executable 'rpmbuild'"); that is expected.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
image=orca-deb-build:node24
[[ -d "$repo/node_modules" ]] || { echo "run pnpm install in $repo first" >&2; exit 1; }
# Why: a host install uses pnpm's global virtual store in ~/.local by default; its links point
# outside the bind-mounted worktree. The container relinks into an in-tree store itself.
vstore="$(sed -n 's/^  "virtualStoreDir": "\(.*\)",$/\1/p' "$repo/node_modules/.modules.yaml")"
[[ "$vstore" == /* ]] || vstore="$repo/node_modules/$vstore"
[[ "$(realpath -m "$vstore")/" == "$(realpath "$repo")"/* ]] || {
  echo "node_modules links outside $repo: reinstall with ORCA_PNPM_GLOBAL_VIRTUAL_STORE=0" >&2; exit 1; }

docker build -q -t "$image" -f "$repo/scripts/docker/deb-build.Dockerfile" "$repo/scripts/docker" >/dev/null

# Why: the repo is mounted at its real path so node_modules symlinks and cached absolute paths resolve.
# Why: a freshly created volume is root-owned; the build runs as the host user.
docker run --rm -v orca-deb-cache:/cache "$image" chown "$(id -u):$(id -g)" /cache

# Why: packaging needs the Wayland clipboard helper, which upstream compiles in its own Docker
# image; the build container has no Docker, so build it from the host first (it is cached by hash).
node "$repo/config/scripts/native-build/linux/build-wayland-clipboard.mjs" --arch x64

# Why: the build pins the source commit with `git rev-parse HEAD`; a worktree's .git points into
# the main clone's git dir, which the container sees read-only at its real path.
git_common="$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)"

docker run --rm --user "$(id -u):$(id -g)" \
  -e HOME=/home/builder -e XDG_CACHE_HOME=/cache -e ORCA_BACKGROUND_LAUNCH=1 \
  -v orca-deb-cache:/cache \
  -v "$repo":"$repo" \
  -v "$git_common":"$git_common":ro \
  --tmpfs /home/builder:uid="$(id -u)",gid="$(id -g)",exec \
  "$image" bash -c "cd \"$repo\" && pnpm run build:linux" || true
ls -l "$repo"/dist/*.deb
