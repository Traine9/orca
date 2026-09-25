import { FileDiff, Files } from 'lucide-react'
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { buildCcTabdiffIndexUrl, buildCcTabdiffTabUrl } from '../../../shared/cc-tabdiff/base-url'
import { getCcTabdiffBaseUrl, openCcTabdiffPage } from './cc-tabdiff-links'

type CcTabdiffTabMenuItemsProps = {
  /** The terminal tab id, which Orca exports to the tab's shells as ORCA_TAB_ID. */
  tabId: string
  worktreeId: string
}

/** Terminal tab context menu rows that open this tab's diff (or all tabs) in the Orca browser. */
export function CcTabdiffTabMenuItems({
  tabId,
  worktreeId
}: CcTabdiffTabMenuItemsProps): React.JSX.Element | null {
  const baseUrl = useAppStore((state) => getCcTabdiffBaseUrl(state.settings))
  if (!baseUrl) {
    return null
  }
  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={() => openCcTabdiffPage(buildCcTabdiffTabUrl(baseUrl, tabId), worktreeId)}
      >
        <FileDiff className="size-3.5" />
        {translate('ccTabdiff.menu.openTabDiff', 'Open tab diff')}
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => openCcTabdiffPage(buildCcTabdiffIndexUrl(baseUrl), worktreeId)}
      >
        <Files className="size-3.5" />
        {translate('ccTabdiff.menu.allTabDiffs', 'All tab diffs')}
      </ContextMenuItem>
    </>
  )
}
