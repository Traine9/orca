import type { GlobalSettings } from '../global-settings-types'

export const CC_TABDIFF_DEFAULT_PORT = 8787
export const CC_TABDIFF_DEFAULT_BASE_URL = `http://127.0.0.1:${CC_TABDIFF_DEFAULT_PORT}`

export type CcTabdiffSettings = Pick<GlobalSettings, 'diffViewerBaseUrl' | 'ccTabdiffServer'>

// Profiles saved before the setting existed have no value; the server is on by default.
export function isCcTabdiffServerEnabled(
  settings: Partial<CcTabdiffSettings> | null | undefined
): boolean {
  return settings?.ccTabdiffServer !== false
}

function trimBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

/** A configured URL wins; else the built-in server's loopback address where it can run; else ''. */
export function resolveCcTabdiffBaseUrl(
  settings: Partial<CcTabdiffSettings> | null | undefined,
  builtInServerAvailable: boolean
): string {
  const configured = settings?.diffViewerBaseUrl?.trim()
  if (configured) {
    return trimBase(configured)
  }
  return builtInServerAvailable && isCcTabdiffServerEnabled(settings)
    ? CC_TABDIFF_DEFAULT_BASE_URL
    : ''
}

export function buildCcTabdiffTabUrl(baseUrl: string, tabId: string): string {
  return `${trimBase(baseUrl)}/t/${encodeURIComponent(tabId)}`
}

export function buildCcTabdiffIndexUrl(baseUrl: string): string {
  return `${trimBase(baseUrl)}/`
}
