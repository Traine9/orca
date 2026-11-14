import { openHttpLink } from '@/lib/browser/navigation/http-link-routing'
import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import {
  resolveCcTabdiffBaseUrl,
  type CcTabdiffSettings
} from '../../../shared/cc-tabdiff/base-url'

/** The built-in server ships in the Linux desktop build only; a paired web client is another machine. */
export function isCcTabdiffBuiltInServerAvailable(): boolean {
  return (
    !isPairedWebClientWindow() &&
    typeof navigator !== 'undefined' &&
    navigator.userAgent.includes('Linux')
  )
}

/** Effective viewer address: the "Diff viewer URL" setting, else the built-in server, else ''. */
export function getCcTabdiffBaseUrl(
  settings: Partial<CcTabdiffSettings> | null | undefined
): string {
  return resolveCcTabdiffBaseUrl(settings, isCcTabdiffBuiltInServerAvailable())
}

/** Opens a viewer page in this client's Orca browser, like the MR-link "Diff viewer" row. */
export function openCcTabdiffPage(url: string, worktreeId: string): void {
  openHttpLink(url, { worktreeId, forceInApp: true, sourceOwner: { kind: 'local' } })
}
