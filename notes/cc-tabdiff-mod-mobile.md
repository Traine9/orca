# cc-tabdiff mod: mobile app

The Orca mobile app (`mobile/`, Expo / React Native) gets a full-screen viewer for
cc-tabdiff, the per-tab diff server that the desktop mod runs on port 8787 (see
`notes/cc-tabdiff-mod.md` for the desktop side). All new code lives in
`mobile/src/cc-tabdiff/`; existing upstream files only get short touch points marked
`// cc-tabdiff mod`, so the mod ports to a new Orca release by re-applying them.

## What was added

| File | Purpose |
| --- | --- |
| `mobile/app/cc-tabdiff.tsx` | Route `/cc-tabdiff` (params `hostId`, then `tab` or `mr`; neither = all tabs). Lives at the root, not under `h/[hostId]`, so it opens without the host protocol gate. |
| `mobile/src/cc-tabdiff/DiffViewerScreen.tsx` | The screen: WebView plus a header (title, close, reload, open in phone browser). Hardware back = WebView back. Pull to refresh (native on iOS; on Android a `RefreshControl` wrapper armed only while the page is at its top). Swipe back/forward on iOS, mixed content allowed, bottom padding follows the keyboard (edge-to-edge Android does not resize for the IME). Off-viewer links open in the phone browser. Error state: "cc-tabdiff not running on the desktop at <url>" with Retry. |
| `mobile/src/cc-tabdiff/url.ts` | URL helpers: `deriveCcTabdiffBaseUrl`, `normalizeCcTabdiffBaseUrl`, `resolveCcTabdiffBaseUrl`, `tabDiffUrl(base, tabId)`, `allDiffsUrl(base)`, `openMrUrl(base, link)`, `orcaTabIdOf(tab)`, `isCcTabdiffUrl`. Re-exports the desktop's `isMergeRequestUrl` from `src/shared/diff-viewer-links.ts`. |
| `mobile/src/cc-tabdiff/url.test.ts`, `sheet-actions.test.ts` | Vitest. |
| `mobile/src/cc-tabdiff/preference.ts` | Preference `ccTabdiffBaseUrl` (AsyncStorage key `orca:ccTabdiffBaseUrl`). Empty = derived default. |
| `mobile/src/cc-tabdiff/base.ts` | Resolves the base URL for a host: preference, else `http://<host of the host's endpoint>:8787`. |
| `mobile/src/cc-tabdiff/navigation.ts` | `openCcTabdiff(hostId, target)`, and `withCcTabdiffMrChooser` for terminal link taps. |
| `mobile/src/cc-tabdiff/sheet-actions.ts` | "Open diff" / "All diffs" action-sheet entries. Kept free of react-native so the upstream builder tests still load it. |
| `mobile/src/cc-tabdiff/CcTabdiffSettingsSection.tsx` | Settings → Browser → DIFF VIEWER → "Diff viewer URL". The placeholder shows the derived default. |
| `mobile/scripts/cc-tabdiff/android-env.sh` | Exports `JAVA_HOME` / `ANDROID_HOME` for the user-local JDK and SDK. |
| `mobile/scripts/cc-tabdiff/check-touchpoints.sh` | Checks every touch point below; exits 1 and lists what is missing. |

### Entry points

- **Terminal long-press sheet** → "Open diff": opens that terminal's Orca tab.
- **Session header more-menu (⋯)** → "Open diff" (when the active tab is a terminal) and "All diffs". The ⋯ button is now always shown.
- **Home screen host long-press sheet** → "All diffs", appended after "Remove".
- **Terminal tap on a GitLab MR / GitHub PR / Bitbucket Cloud PR link** → a chooser with Cancel / Open link / Diff viewer. Other links behave as before. The chooser uses the same `isMergeRequestUrl` as the desktop.

### Tab identity

The desktop exports `ORCA_TAB_ID` = the desktop tab id: `src/main/ipc/pty/ipc/spawn-env.ts` sets it from `args.tabId`. A mobile terminal tab has id `<desktopTabId>::<leafId>` and `parentTabId = <desktopTabId>` (`src/main/runtime/mobile-session-terminal-projection.ts`). So `/t/<parentTabId>` is the right page. `orcaTabIdOf` falls back to the id prefix before `::`.

## Touch points (file → anchor)

| File | Anchor |
| --- | --- |
| `mobile/app/_layout.tsx` | `<Stack.Screen name="cc-tabdiff" …>` after the `about` screen |
| `mobile/src/storage/preferences.ts` | `export { loadCcTabdiffBaseUrl, saveCcTabdiffBaseUrl } from '../cc-tabdiff/preference'` after `saveTerminalLinkOpenMode` |
| `mobile/src/settings/browser-settings-screen.tsx` | import, plus `<CcTabdiffSettingsSection />` after the LINKS section |
| `mobile/src/terminal/session/mobile-terminal-action-sheet-actions.ts` | import, plus `...ccTabdiffTerminalActions(sessionTab)` after the Clear Terminal action |
| `mobile/src/session/MobileSessionHeaderMoreMenu.tsx` | import, plus `ccTabdiffHeaderActions(controller)` as the last `groups` entry of the header pull-down menu |
| `mobile/src/terminal/session/TerminalPaneView.tsx` | import, plus `onOpenUrl={(url) => withCcTabdiffMrChooser(url, () => onOpenUrl(handle, url))}` |
| `mobile/src/home/MobileHomeScreen.tsx` | import, plus `}).concat(ccTabdiffHostActions(actionTarget))}` closing the `getHostListActionSheetActions` call |

## Build the APK

One-time toolchain, user-local, no root:

- JDK: Temurin 17 in `~/.local/jdk-17` (318 MB, 17.0.20.1), from the official Adoptium download, SHA-256 verified.
- Android SDK: `~/Android/Sdk` (2.7 GB). It holds cmdline-tools from Google (SHA-256 verified), platform android-36, build-tools 35.0.0 and 36.0.0, NDK 27.1.12297006 (2.0 GB of the total), CMake 3.22.1 and platform-tools.
- Gradle caches: `~/.gradle` (4.2 GB).

Build (the same steps as `.github/workflows/mobile-android-release.yml`):

```sh
cd mobile
pnpm install                                          # once
npx expo prebuild --platform android --no-install     # regenerates mobile/android (gitignored)
cd android
. ../scripts/cc-tabdiff/android-env.sh
setsid nohup ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a > /tmp/orca-mobile-build.log 2>&1 &
tail -f /tmp/orca-mobile-build.log
```

Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`. The package id is unchanged: `com.stably.orca.mobile`. The release build is signed with the Expo template's `debug.keystore`, the same as the upstream CI APK. `-PreactNativeArchitectures=arm64-v8a` keeps only the phone's ABI; drop it for a universal APK.

## Install on the phone (Galaxy S24)

The upstream GitHub-release APK (`mobile-android-v*` tags) is signed with the same Expo debug key. The certificate SHA-256 is `fac61745…91033b9c`, checked on 0.0.50 and on this build (`build-tools/36.0.0/apksigner verify --print-certs`). So this build updates it in place and keeps the pairing, as long as its versionCode is not lower (0.0.51 / 18 vs upstream 0.0.50 / 17):

1. Install: `adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk` (USB debugging on), or copy the APK to the phone and open it (allow "install unknown apps" for the file manager).
2. If Android refuses the install (a store build with another key, or a newer upstream versionCode): uninstall Orca on the phone, install again, then pair again from the desktop's mobile pairing QR code.
3. Optional: Settings → Browser → Diff viewer URL, if cc-tabdiff is not on the desktop's paired address at port 8787 (for example it sits behind a different LAN or Tailscale name).

## Porting to a new Orca release

1. Rebase, then run `sh mobile/scripts/cc-tabdiff/check-touchpoints.sh`. Re-apply every anchor it reports missing, using the table above.
2. Keep the calls out of hashed or parity-pinned callbacks: the terminal action goes in the builder file and the MR chooser in `TerminalPaneView.tsx`, not in `use-mobile-session-file-actions.ts`.
3. Upstream builder tests (`host-list-action-sheet-actions.test.ts`, `mobile-terminal-action-sheet-actions.test.ts`) run in plain Node and mock `lucide-react-native` with only the icons they use. `sheet-actions.ts` must stay free of react-native and expo-router, and must read icons lazily from the namespace import.
4. React Native's `URL` polyfill parses hostnames only for http(s). The endpoint host is taken with a regex, so do not "simplify" it to `new URL(ws://…)`.
5. Check that `src/shared/diff-viewer-links.ts` (owned by the desktop mod) still exports `isMergeRequestUrl` and `buildDiffViewerUrl`.
6. Checks from `mobile/`: `tsc --noEmit`, `vitest run src/cc-tabdiff src/session src/home src/*.test.ts`, then `oxlint` and `oxfmt --check` on the touched files. Do not run `pnpm run format` at the repo root.
