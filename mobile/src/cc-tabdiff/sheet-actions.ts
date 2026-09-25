import { createElement } from 'react'
// Namespace import, read at render time: the action-sheet builder tests mock only the icons they use.
import * as Lucide from 'lucide-react-native'
import type { ActionSheetAction } from '../components/ActionSheetModal'
import { colors } from '../theme/mobile-theme'
import type { CcTabdiffTarget } from './navigation'
import { orcaTabIdOf } from './url'

// Kept free of react-native and expo-router so the pure sheet builders stay importable in vitest.
type SessionTabLike = { type: string; id: string; parentTabId?: string }

function open(hostId: string | undefined, target?: CcTabdiffTarget): void {
  void import('./navigation').then((navigation) => navigation.openCcTabdiff(hostId, target))
}

function icon(name: 'FileDiff' | 'GitCompareArrows') {
  return () =>
    createElement(name === 'FileDiff' ? Lucide.FileDiff : Lucide.GitCompareArrows, {
      size: 16,
      color: colors.textSecondary
    })
}

function openDiffAction(hostId: string | undefined, tab: SessionTabLike): ActionSheetAction {
  return {
    label: 'Open diff',
    hint: 'This tab in the diff viewer',
    renderIcon: icon('FileDiff'),
    closeBeforePress: true,
    onPress: () => open(hostId, { tab: orcaTabIdOf(tab) })
  }
}

function allDiffsAction(hostId: string | undefined): ActionSheetAction {
  return {
    label: 'All diffs',
    hint: 'Every tab in the diff viewer',
    renderIcon: icon('GitCompareArrows'),
    closeBeforePress: true,
    onPress: () => open(hostId)
  }
}

/** Terminal long-press sheet: the pressed terminal's session tab, when it has one. */
export function ccTabdiffTerminalActions(tab: SessionTabLike | undefined): ActionSheetAction[] {
  return tab ? [openDiffAction(undefined, tab)] : []
}

/** Session header more-menu: the active terminal tab, then every tab. */
export function ccTabdiffHeaderActions(controller: {
  hostId: string
  activeSessionTab: SessionTabLike | null
}): ActionSheetAction[] {
  const tab = controller.activeSessionTab
  return [
    ...(tab?.type === 'terminal' ? [openDiffAction(controller.hostId, tab)] : []),
    allDiffsAction(controller.hostId)
  ]
}

/** Home screen host long-press sheet (appended after the host's own actions). */
export function ccTabdiffHostActions(host: { id: string } | null): ActionSheetAction[] {
  return host ? [allDiffsAction(host.id)] : []
}
