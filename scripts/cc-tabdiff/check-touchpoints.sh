#!/usr/bin/env bash
# Rebase smoke test for the cc-tabdiff mod (see notes/cc-tabdiff-mod.md).
# Checks that every "cc-tabdiff mod" touch point and every upstream anchor the mod relies on
# still exists, and that no marker sits in a file this list does not know. Exit 1 lists the gaps.
set -uo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo" || exit 2
missing=0

# need FILE TEXT: FILE must contain TEXT (fixed string).
need() {
  if ! grep -qF -- "$2" "$1" 2>/dev/null; then
    echo "MISSING  $1: $2"
    missing=$((missing + 1))
  fi
}

M='// cc-tabdiff mod'
J='{/* cc-tabdiff mod */}'

# --- Touch points: edits to upstream files, each carrying the marker ---
f=src/main/startup/main-process-ready-runtime.ts
need $f "import { startCcTabdiffService } from '../cc-tabdiff/start' $M"
need $f "  startCcTabdiffService(store) $M"
f=src/shared/global-settings-types.ts
need $f "  diffViewerBaseUrl?: string $M"
need $f "  ccTabdiffServer?: boolean $M"
f=src/shared/default-global-settings.ts
need $f "    diffViewerBaseUrl: '', $M"
need $f "    ccTabdiffServer: true, $M"
f=src/renderer/src/store/index.ts
need $f "import { registerDiffViewerSettingsAccessor } from '@/lib/diff-viewer-link-action' $M"
need $f "registerDiffViewerSettingsAccessor(() => useAppStore.getState().settings) $M"
f=src/renderer/src/components/tab-bar/SortableTabContextMenu.tsx
need $f "import { CcTabdiffTabMenuItems } from '@/cc-tabdiff/CcTabdiffTabMenuItems' $M"
need $f "$J"
need $f "<CcTabdiffTabMenuItems tabId={tab.id} worktreeId={tab.worktreeId} />"
f=src/renderer/src/components/settings/browser/BrowserPane.tsx
need $f "import { BrowserDiffViewerSetting } from './routing/BrowserDiffViewerSetting' $M"
need $f "import { CcTabdiffServerSetting } from '@/cc-tabdiff/CcTabdiffServerSetting' $M"
need $f "$J"
need $f "<BrowserDiffViewerSetting settings={settings} updateSettings={updateSettings} />"
need $f "<CcTabdiffServerSetting settings={settings} updateSettings={updateSettings} />"
f=src/renderer/src/components/link-actions/LinkActionPopover.tsx
need $f "$J"
need $f "{request.diffViewer ? ("
f=src/renderer/src/components/link-actions/link-action-request.ts
need $f "  diffViewer?: LinkAction $M"
f=src/renderer/src/components/native-chat/links/actions/native-chat-web-link-actions.ts
need $f "import { buildDiffViewerLinkAction } from '@/lib/diff-viewer-link-action' $M"
need $f "    diffViewer: buildDiffViewerLinkAction(url, deps.worktreeId) $M"
f=src/renderer/src/components/terminal-pane/links/http/terminal-url-link-hit-testing.ts
need $f "import { buildDiffViewerLinkAction } from '@/lib/diff-viewer-link-action' $M"
need $f "    diffViewer: buildDiffViewerLinkAction(url, deps.worktreeId) $M"
f=src/renderer/src/components/terminal-pane/links/terminal-link-action-request.ts
need $f "'diffViewer' $M"
f=config/electron-builder.config.cjs
need $f "const ccTabdiff = require('../scripts/cc-tabdiff/electron-builder.cjs') $M"
need $f "    ...ccTabdiff.asarExcludes $M"
need $f "      ccTabdiff.linuxResource, $M"
f=config/scripts/desktop-distribution/linux/build-linux-local.mjs
need $f "import { buildCcTabdiffServer } from '../../../../scripts/cc-tabdiff/prebuild.mjs' $M"
need $f "  buildCcTabdiffServer({ arch, cwd, env, execFile, platform }) $M"
f=config/scripts/native-build/linux/verify-linux-glibc-floor.cjs
need $f "    const isStatic = neededLibraries.size === 0 && versionNeeds.length === 0 $M"
need $f "      !isStatic &&"
# JSON cannot carry a marker: the mod's strings live in one top-level block.
f=src/renderer/src/i18n/locales/en.json
need $f '  "ccTabdiff": {'
need $f '"diffViewer": "Diff viewer"'
need $f '"title": "Diff viewer URL"'

# --- Upstream anchors: APIs and contracts the mod's own files depend on ---
# ORCA_TAB_ID (what Claude Code hooks file diffs under) is the terminal tab id, TerminalTab.id.
need src/main/ipc/pty/spawn-pane-env.ts "env.ORCA_TAB_ID = pane.tabId"
need src/renderer/src/components/terminal-pane/pty-connection/connect-pane-pty.ts \
  "findTerminalTabForPane(useAppStore.getState(), deps.worktreeId, deps.tabId)"
need src/renderer/src/components/terminal-pane/mounting/terminal-pane-pty-deps.ts "tabId: deps.tabId,"
need src/renderer/src/components/tab-bar/SortableTabContextMenu.tsx "  tab: Pick<TerminalTab, 'id' | 'worktreeId'"
need src/renderer/src/components/tab-bar/SortableTabContextMenu.tsx "</ContextMenuCheckboxItem>"
need src/shared/workspace-layout/terminal-tab-types.ts "export type TerminalTab = {"
need src/renderer/src/lib/browser/navigation/http-link-routing.ts \
  "export function openHttpLink(url: string, opts: OpenHttpLinkOptions = {}): void"
need src/renderer/src/lib/browser/navigation/http-link-destinations.ts "  forceInApp?: boolean"
need src/renderer/src/lib/browser/navigation/http-link-routing.ts "export function registerHttpLinkStoreAccessor("
need src/renderer/src/lib/desktop-window-chrome.ts "export function isPairedWebClientWindow(): boolean"
need src/renderer/src/components/settings/form-controls/SettingsFormControls.tsx "export function SettingsSwitchRow("
need src/renderer/src/components/settings/section-layout/SearchableSetting.tsx "export function SearchableSetting("
need src/renderer/src/components/ui/context-menu.tsx "ContextMenuSeparator"
need src/main/persistence/loading-store/profile-preferences.ts "  onSettingsChanged("
need src/main/startup/main-process-ready-runtime.ts \
  "export async function initializeReadyRuntimeServices(): Promise<void>"
need src/main/startup/testing/e2e-config.ts "export function getMainE2EConfig(): E2EConfig"
need config/electron-builder.config.cjs "  linux: {"
need config/electron-builder.config.cjs "    extraResources: ["
need config/scripts/desktop-distribution/linux/build-linux-local.mjs "export function runLocalLinuxBuild({"
need package.json "node config/scripts/desktop-distribution/linux/build-linux-local.mjs"

# --- Stray markers: a marker in a file not listed above means this list is out of date ---
known='^(src/main/startup/main-process-ready-runtime.ts|src/shared/global-settings-types.ts|src/shared/default-global-settings.ts|src/renderer/src/store/index.ts|src/renderer/src/components/tab-bar/SortableTabContextMenu.tsx|src/renderer/src/components/settings/browser/BrowserPane.tsx|src/renderer/src/components/link-actions/(LinkActionPopover.tsx|link-action-request.ts)|src/renderer/src/components/native-chat/links/actions/native-chat-web-link-actions.ts|src/renderer/src/components/terminal-pane/links/(http/terminal-url-link-hit-testing|terminal-link-action-request).ts|config/electron-builder.config.cjs|config/scripts/(desktop-distribution/linux/build-linux-local.mjs|native-build/linux/verify-linux-glibc-floor.cjs))$'
# The mobile mod (mobile/, notes/cc-tabdiff-mod-mobile.md) keeps its own list.
while IFS= read -r file; do
  if ! [[ "$file" =~ $known ]]; then
    echo "UNLISTED marker in $file (add it to this script and notes/cc-tabdiff-mod.md)"
    missing=$((missing + 1))
  fi
done < <(git grep --untracked -l -F 'cc-tabdiff mod' -- . ':!mobile' ':!notes' ':!scripts/cc-tabdiff' \
  ':!src/main/cc-tabdiff' ':!src/renderer/src/cc-tabdiff' ':!src/shared/cc-tabdiff')

if ((missing > 0)); then
  echo "cc-tabdiff mod: $missing problem(s); re-apply the touch points listed in notes/cc-tabdiff-mod.md"
  exit 1
fi
echo "cc-tabdiff mod: all touch points and anchors present"
