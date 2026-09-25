#!/usr/bin/env bash
# Build the cc-tabdiff server (Go, static) into resources/cc-tabdiff/linux-<arch>/ for packaging.
#
# Usage: scripts/cc-tabdiff/build-server.sh [x64|arm64]   (default: x64)
#   CC_TABDIFF_SRC  cc-tabdiff checkout to build from (default: ~/sda6/cc-tabdiff)
#
# Writes cc-tabdiff and VERSION ("<git describe or nogit>-<sha256 prefix of the binary>").
# Orca compares VERSION with the running server's pidfile to decide whether to restart it.
# Without a checkout (or without go) an already built binary is kept; with neither, it fails.
set -euo pipefail

arch="${1:-x64}"
case "$arch" in
  x64) goarch=amd64 ;;
  arm64) goarch=arm64 ;;
  *) echo "cc-tabdiff: unsupported arch: $arch" >&2; exit 1 ;;
esac

repo="$(cd "$(dirname "$0")/../.." && pwd)"
src="${CC_TABDIFF_SRC:-$HOME/sda6/cc-tabdiff}"
out="$repo/resources/cc-tabdiff/linux-$arch"
bin="$out/cc-tabdiff"

if [[ ! -f "$src/go.mod" ]] || ! command -v go >/dev/null 2>&1; then
  if [[ -x "$bin" && -f "$out/VERSION" ]]; then
    echo "cc-tabdiff: no source at $src or no go; keeping $bin ($(cat "$out/VERSION"))" >&2
    exit 0
  fi
  echo "cc-tabdiff: cannot build: need a checkout at \$CC_TABDIFF_SRC ($src) and go on PATH" >&2
  exit 1
fi

mkdir -p "$out"
tmp="$out/.cc-tabdiff.tmp"
(cd "$src" && CGO_ENABLED=0 GOOS=linux GOARCH="$goarch" go build -trimpath -ldflags '-s -w' -o "$tmp" .)
describe="$(git -C "$src" describe --always --dirty 2>/dev/null || echo nogit)"
sha="$(sha256sum "$tmp" | cut -c1-12)"
mv -f "$tmp" "$bin"
printf '%s-%s\n' "$describe" "$sha" > "$out/VERSION"
echo "cc-tabdiff: built $bin ($(cat "$out/VERSION"))"
