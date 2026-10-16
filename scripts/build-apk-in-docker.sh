#!/usr/bin/env bash
# Build the fork's release APK inside Docker (no host JDK needed).
#
# Usage: scripts/build-apk-in-docker.sh [--prebuild]
#   --prebuild: regenerate mobile/android with `expo prebuild` first (needed after an app.json change).
# Needs: mobile/node_modules installed (pnpm install in mobile/), the Android SDK at
# ${ANDROID_SDK_DIR:-$HOME/Android/Sdk} (mounted read-only). Gradle's cache lives in the
# `orca-android-gradle` volume. APK_ARCH picks the ABI (default arm64-v8a, the phone; x86_64 for
# an emulator test build). Output: mobile/android/app/build/outputs/apk/release/app-release.apk
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
sdk="${ANDROID_SDK_DIR:-$HOME/Android/Sdk}"
image=orca-android-build:jdk17-node24
[[ -d "$repo/mobile/node_modules" ]] || { echo "run pnpm install in $repo/mobile first" >&2; exit 1; }
# Why: a host install uses pnpm's global virtual store in ~/.local by default; its links point
# outside the bind-mounted worktree. The container relinks into an in-tree store itself.
vstore="$(sed -n 's/^  "virtualStoreDir": "\(.*\)",$/\1/p' "$repo/node_modules/.modules.yaml")"
[[ "$vstore" == /* ]] || vstore="$repo/node_modules/$vstore"
[[ "$(realpath -m "$vstore")/" == "$(realpath "$repo")"/* ]] || {
  echo "node_modules links outside $repo: reinstall with ORCA_PNPM_GLOBAL_VIRTUAL_STORE=0" >&2; exit 1; }

docker build -q -t "$image" -f "$repo/scripts/docker/android-build.Dockerfile" "$repo/scripts/docker" >/dev/null

steps="cd \"$repo/mobile\""
[[ "${1:-}" == "--prebuild" ]] && steps+=" && CI=1 npx expo prebuild --platform android --no-install"
steps+=" && cd android && ./gradlew --no-daemon assembleRelease -PreactNativeArchitectures=${APK_ARCH:-arm64-v8a}"

# Why: a freshly created volume is root-owned; the build runs as the host user.
docker run --rm -v orca-android-gradle:/gradle "$image" chown "$(id -u):$(id -g)" /gradle

docker run --rm --user "$(id -u):$(id -g)" \
  -e HOME=/home/builder -e GRADLE_USER_HOME=/gradle \
  -v orca-android-gradle:/gradle \
  -v "$sdk":/opt/android-sdk:ro \
  -v "$repo":"$repo" \
  --tmpfs /home/builder:uid="$(id -u)",gid="$(id -g)",exec \
  "$image" bash -c "$steps"
ls -l "$repo/mobile/android/app/build/outputs/apk/release/"*.apk
