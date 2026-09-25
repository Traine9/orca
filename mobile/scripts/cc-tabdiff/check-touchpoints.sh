#!/bin/sh
# Verifies the cc-tabdiff mobile mod's touch points after a rebase onto a new Orca release.
# Usage: sh mobile/scripts/cc-tabdiff/check-touchpoints.sh  (exits non-zero and lists what is missing)
set -u
cd "$(dirname "$0")/../.." || exit 2
missing=0

fail() {
  echo "MISSING: $1"
  missing=$((missing + 1))
}

# file, then a fixed string that must appear in it
need() {
  if [ ! -f "$1" ]; then
    fail "$1 (file gone)"
  elif ! grep -qF -- "$2" "$1"; then
    fail "$1: $2"
  fi
}

# file, then the minimum number of 'cc-tabdiff mod' markers
markers() {
  if [ -f "$1" ]; then
    count=$(grep -c 'cc-tabdiff mod' "$1")
    [ "$count" -ge "$2" ] || fail "$1: expected >= $2 'cc-tabdiff mod' markers, found $count"
  fi
}

for f in app/cc-tabdiff.tsx src/cc-tabdiff/DiffViewerScreen.tsx src/cc-tabdiff/url.ts \
  src/cc-tabdiff/preference.ts src/cc-tabdiff/base.ts src/cc-tabdiff/navigation.ts \
  src/cc-tabdiff/sheet-actions.ts src/cc-tabdiff/CcTabdiffSettingsSection.tsx \
  ../src/shared/diff-viewer-links.ts; do
  [ -f "$f" ] || fail "$f (new file gone)"
done
need ../src/shared/diff-viewer-links.ts 'export function isMergeRequestUrl'
need ../src/shared/diff-viewer-links.ts 'export function buildDiffViewerUrl'

need app/_layout.tsx 'name="cc-tabdiff"'
markers app/_layout.tsx 1

need src/storage/preferences.ts "from '../cc-tabdiff/preference'"
markers src/storage/preferences.ts 1

need src/settings/browser-settings-screen.tsx '<CcTabdiffSettingsSection'
markers src/settings/browser-settings-screen.tsx 2

need src/terminal/session/mobile-terminal-action-sheet-actions.ts '...ccTabdiffTerminalActions(sessionTab)'
markers src/terminal/session/mobile-terminal-action-sheet-actions.ts 2

need src/session/MobileSessionHeaderMoreMenu.tsx 'groups={[panels, view, tabs, ccTabdiffHeaderActions(controller)]'
markers src/session/MobileSessionHeaderMoreMenu.tsx 2

need src/terminal/session/TerminalPaneView.tsx 'withCcTabdiffMrChooser(url, () => onOpenUrl(handle, url))'
markers src/terminal/session/TerminalPaneView.tsx 2

need src/home/MobileHomeScreen.tsx '.concat(ccTabdiffHostActions(actionTarget))'
markers src/home/MobileHomeScreen.tsx 2

if [ "$missing" -gt 0 ]; then
  echo "cc-tabdiff mobile mod: $missing touch point(s) missing"
  exit 1
fi
echo 'cc-tabdiff mobile mod: all touch points present'
