# cc-tabdiff mod (desktop)

This fork runs the [cc-tabdiff](../../cc-tabdiff/README.md) diff viewer from Orca and opens its pages
in Orca's built-in browser. cc-tabdiff is a small Go server. Claude Code hooks write each edit to a
spool in `~/.cache/cc-tabdiff`, and the server shows one merged diff per Orca tab, with line comments
you can leave from the phone. The phone side of the mod is described in
[cc-tabdiff-mod-mobile.md](cc-tabdiff-mod-mobile.md).

The mod is built to survive upstream Orca releases:

- New code lives in new files under `src/main/cc-tabdiff/`, `src/renderer/src/cc-tabdiff/`,
  `src/shared/cc-tabdiff/` and `scripts/cc-tabdiff/`.
- Edits to upstream files are short "touch points". Each carries a `// cc-tabdiff mod` marker, or
  `{/* cc-tabdiff mod */}` inside JSX.
- The Go server is not vendored. A script builds it from the cc-tabdiff checkout, so the server
  evolves on its own.

## What the user gets

- **Terminal tab context menu**: "Open tab diff" opens `<base>/t/<tab id>` in an Orca browser tab.
  "All tab diffs" opens `<base>/`, the list of tabs and merge requests.
- **MR/PR links** in the terminal and in chat: the link popover has a "Diff viewer" row. It opens
  `<base>/open?url=<MR URL>`.
- **Settings → Browser**:
  - "Diff viewer URL" (`diffViewerBaseUrl`, default empty) points at a viewer somewhere else.
  - "Run built-in diff viewer server" (`ccTabdiffServer`, default on) starts the bundled server.
    This toggle is shown on the Linux desktop only.

`<base>` is `diffViewerBaseUrl` when it is set. Otherwise, on the Linux desktop with the server
setting on, it is `http://127.0.0.1:8787`. With neither, the menu rows and the popover row are
hidden. The logic is `resolveCcTabdiffBaseUrl` in `src/shared/cc-tabdiff/base-url.ts`.

### Which tab id

The id in `/t/<tab id>` is `TerminalTab.id`, the same value Orca exports to the tab's shells as
`ORCA_TAB_ID`. The cc-tabdiff hooks file every edit under that id. The chain is:

1. The pane mounts with `deps.tabId = TerminalTab.id` (`connect-pane-pty.ts`,
   `terminal-pane-pty-deps.ts`).
2. The renderer sends it as `tabId` in the PTY spawn request.
3. `src/main/ipc/pty/spawn-pane-env.ts` sets `env.ORCA_TAB_ID = pane.tabId`.

The "Rate limit watcher" checkbox in the same menu relies on the same fact.

## Server lifecycle (`src/main/cc-tabdiff/`)

`startCcTabdiffService(store)` is called from `initializeReadyRuntimeServices`. It does nothing on
non-Linux platforms and in e2e runs. It applies the `ccTabdiffServer` setting at startup and again
whenever the setting changes.

When the setting is on (`ensureCcTabdiffServer` in `service.ts`):

1. **No binary.** If there is no bundled binary (a dev checkout that never ran the build script,
   or another platform), do nothing.
2. **Nothing answers.** If `GET http://127.0.0.1:8787/healthz` does not answer, spawn the binary.
   - The binary runs detached, like the PTY daemon, so it survives GUI restarts. Its stdout and
     stderr are appended to `~/.cache/cc-tabdiff/server.log`, which is rotated to `server.log.1`
     past 5 MiB.
   - Arguments: `-data ~/.cache/cc-tabdiff -addr 0.0.0.0:8787`, followed by the words of
     `CC_TABDIFF_ARGS`. The address is reachable from the LAN so the phone can connect; the
     server's own Host allowlist protects it.
   - Environment: Orca's environment, plus `GOMEMLIMIT=100MiB`, plus every `KEY=VALUE` line of
     `~/.config/cc-tabdiff/forge.env`. That file carries the forge tokens, `CC_TABDIFF_HOSTS` and
     `CC_TABDIFF_ARGS`.
   - Orca writes `~/.cache/cc-tabdiff/server.pid`: the pid on the first line, the bundled
     `VERSION` on the second.
3. **Something answers.** Leave it running, with one exception: the pidfile's version differs from
   the bundled `VERSION`, and its pid is alive with `/proc/<pid>/comm` equal to `cc-tabdiff`. Then
   Orca sends SIGTERM, waits for the port to go quiet, and spawns the new binary. This is how a new
   Orca build upgrades the server. A Docker instance has no pidfile of its own, so Orca never
   touches it.

When the setting is turned off (`stopCcTabdiffServer`), Orca sends SIGTERM only to the process the
pidfile names, and only if that process is a live `cc-tabdiff`.

`CC_TABDIFF_SPOOL` and `CC_TABDIFF_FORGE_ENV` in Orca's environment override the two paths, the
same way they do for the hooks and the compose file. The log gets only Orca's own lines and the
server's output. Token values are never logged, and a unit test checks this.

The port is fixed at 8787 (`CC_TABDIFF_DEFAULT_PORT`). If you need another port, run the server
yourself and set "Diff viewer URL".

## Building the server

```sh
scripts/cc-tabdiff/build-server.sh            # x64; pass arm64 for an arm64 package
CC_TABDIFF_SRC=/path/to/cc-tabdiff scripts/cc-tabdiff/build-server.sh
```

The script runs `CGO_ENABLED=0 go build -trimpath -ldflags '-s -w'` in
`${CC_TABDIFF_SRC:-$HOME/sda6/cc-tabdiff}`. It writes two files into `resources/cc-tabdiff/linux-<arch>/`:

- `cc-tabdiff`, the binary.
- `VERSION`: `git describe` of the source (or `nogit`), a dash, and the first 12 hex digits of the
  binary's sha256.

Both files are gitignored through `resources/cc-tabdiff/.gitignore`. Without a checkout or without
Go, the script keeps a binary that is already there, and fails if there is none.

`pnpm run build:linux` runs this script by itself. `runLocalLinuxBuild` calls
`scripts/cc-tabdiff/prebuild.mjs` before electron-builder. electron-builder then copies the
directory to `resources/cc-tabdiff/linux-<arch>/` of the package (`process.resourcesPath`) and keeps
it out of `app.asar`. In a dev run, the path is `<repo>/resources/cc-tabdiff/linux-<arch>/cc-tabdiff`.

## Touch points

Every edit to an upstream file is listed here. `scripts/cc-tabdiff/check-touchpoints.sh` checks all
of them.

| File | Anchor line text | Purpose |
|------|------------------|---------|
| `src/main/startup/main-process-ready-runtime.ts` | `import { startCcTabdiffService } from '../cc-tabdiff/start' // cc-tabdiff mod` | import |
| same | `startCcTabdiffService(store) // cc-tabdiff mod`, after `nativeTheme.themeSource = …` | start the service |
| `src/shared/global-settings-types.ts` | `diffViewerBaseUrl?: string // cc-tabdiff mod` | setting type |
| same | `ccTabdiffServer?: boolean // cc-tabdiff mod` | setting type |
| `src/shared/default-global-settings.ts` | `diffViewerBaseUrl: '', // cc-tabdiff mod` | default |
| same | `ccTabdiffServer: true, // cc-tabdiff mod` | default |
| `src/renderer/src/store/index.ts` | `import { registerDiffViewerSettingsAccessor } … // cc-tabdiff mod` | import |
| same | `registerDiffViewerSettingsAccessor(() => useAppStore.getState().settings) // cc-tabdiff mod` | settings accessor for link actions |
| `src/renderer/src/components/tab-bar/SortableTabContextMenu.tsx` | `import { CcTabdiffTabMenuItems } … // cc-tabdiff mod` | import |
| same | `{/* cc-tabdiff mod */}` + `<CcTabdiffTabMenuItems tabId={tab.id} worktreeId={tab.worktreeId} />`, after the "Rate limit watcher" `</ContextMenuCheckboxItem>` | menu rows |
| `src/renderer/src/components/settings/browser/BrowserPane.tsx` | `import { BrowserDiffViewerSetting } … // cc-tabdiff mod`, `import { CcTabdiffServerSetting } … // cc-tabdiff mod` | imports |
| same | `{/* cc-tabdiff mod */}` + `<BrowserDiffViewerSetting … />` + `<CcTabdiffServerSetting … />` | settings rows |
| `src/renderer/src/components/link-actions/LinkActionPopover.tsx` | `{/* cc-tabdiff mod */}` before `{request.diffViewer ? (` | "Diff viewer" row |
| `src/renderer/src/components/link-actions/link-action-request.ts` | `diffViewer?: LinkAction // cc-tabdiff mod` | request field |
| `src/renderer/src/components/native-chat/links/actions/native-chat-web-link-actions.ts` | import + `diffViewer: buildDiffViewerLinkAction(url, deps.worktreeId) // cc-tabdiff mod` | chat links |
| `src/renderer/src/components/terminal-pane/links/http/terminal-url-link-hit-testing.ts` | import + `diffViewer: buildDiffViewerLinkAction(url, deps.worktreeId) // cc-tabdiff mod` | terminal links |
| `src/renderer/src/components/terminal-pane/links/terminal-link-action-request.ts` | `… \| 'diffViewer' // cc-tabdiff mod` | request type |
| `config/electron-builder.config.cjs` | `const ccTabdiff = require('../scripts/cc-tabdiff/electron-builder.cjs') // cc-tabdiff mod` | packaging entries |
| same | `...ccTabdiff.asarExcludes // cc-tabdiff mod`, the last entry of `files` | keep out of app.asar |
| same | `ccTabdiff.linuxResource, // cc-tabdiff mod`, in `linux.extraResources` | ship the binary |
| `config/scripts/desktop-distribution/linux/build-linux-local.mjs` | `import { buildCcTabdiffServer } … // cc-tabdiff mod` | import |
| same | `buildCcTabdiffServer({ arch, cwd, env, execFile, platform }) // cc-tabdiff mod`, before the electron-builder call | prebuild |
| `src/renderer/src/i18n/locales/en.json` | the top-level `"ccTabdiff": {` block, plus `components.linkActions.diffViewer` and `settings.browser.diffViewer.*` | strings (JSON has no comments) |

Some of the mod's own files sit outside the `cc-tabdiff` directories, because they came before this
layout. They are new files, not touch points:

- `src/renderer/src/components/settings/browser/routing/BrowserDiffViewerSetting.tsx`
- `src/renderer/src/lib/diff-viewer-link-action.ts` and its test
- `src/shared/diff-viewer-links.ts` and its test

## Porting to a new Orca release

1. Rebase `feat/diff-viewer-link` onto the new release tag.
2. Resolve conflicts. They can only happen at the touch points above: keep upstream's line and
   re-add the marked one next to it.
3. Run `scripts/cc-tabdiff/check-touchpoints.sh`. It checks three things:
   - every marked line is still there;
   - every upstream anchor the mod relies on is still there, such as
     `env.ORCA_TAB_ID = pane.tabId`, `openHttpLink(…)`, `onSettingsChanged(`,
     `linux.extraResources` and `runLocalLinuxBuild`;
   - no marker sits in a file it does not know about.

   A non-zero exit lists what is missing. If an anchor moved, fix the mod's code and update the
   script and this table.
4. Run the mod's tests:
   `pnpm exec vitest run --config config/vitest.config.ts src/main/cc-tabdiff src/shared/cc-tabdiff src/renderer/src/cc-tabdiff src/renderer/src/lib/diff-viewer-link-action.test.ts src/shared/diff-viewer-links.test.ts`
5. Run `pnpm run typecheck`.
6. Run `scripts/cc-tabdiff/build-server.sh`, then `pnpm run build:linux`.
7. Check that the package contains the server:
   `dpkg -c dist/orca-ide_*_amd64.deb | grep cc-tabdiff`.
