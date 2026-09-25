import { translate } from '@/i18n/i18n'
import type { HttpLinkAction } from '@/lib/browser/navigation/http-link-destinations'
import { openHttpLink } from '@/lib/browser/navigation/http-link-routing'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import { buildDiffViewerUrl, isMergeRequestUrl } from '../../../shared/diff-viewer-links'
import { getCcTabdiffBaseUrl } from '@/cc-tabdiff/cc-tabdiff-links'

type DiffViewerSettingsAccessor = () =>
  | Pick<GlobalSettings, 'diffViewerBaseUrl' | 'ccTabdiffServer'>
  | null
  | undefined

// Why: injected by the store like registerHttpLinkStoreAccessor, which avoids a
// circular '@/store' import and leaves the action off wherever no store is registered.
let settingsAccessor: DiffViewerSettingsAccessor | null = null

export function registerDiffViewerSettingsAccessor(fn: DiffViewerSettingsAccessor | null): void {
  settingsAccessor = fn
}

/** Extra link action that opens an MR/PR in the configured diff viewer; undefined when it does not apply. */
export function buildDiffViewerLinkAction(
  url: string,
  worktreeId: string
): HttpLinkAction | undefined {
  const settings = settingsAccessor?.()
  const baseUrl = settings ? getCcTabdiffBaseUrl(settings) : ''
  if (!baseUrl || !isMergeRequestUrl(url)) {
    return undefined
  }
  return {
    external: false,
    label: translate('components.linkActions.diffViewer', 'Diff viewer'),
    // Why: the viewer lives on the user's own network, so it always opens in this
    // client's Orca browser, even when the clicked link came from a remote workspace.
    run: () =>
      openHttpLink(buildDiffViewerUrl(baseUrl, url), {
        worktreeId,
        forceInApp: true,
        sourceOwner: { kind: 'local' }
      })
  }
}
