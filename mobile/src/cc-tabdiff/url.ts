import { buildDiffViewerUrl, isMergeRequestUrl } from '../../../src/shared/diff-viewer-links'

export { isMergeRequestUrl }

export const CC_TABDIFF_PORT = 8787

// Regex instead of URL: React Native's URL polyfill only parses hostnames of http(s) URLs, not ws://.
const ENDPOINT_HOST = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?(\[[^\]]+\]|[^:/?#]+)/i
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i
const HTTP_BASE = /^https?:\/\/(?:\[[^\]]+\]|[^:/?#\s]+)(?::\d+)?(?:\/[^?#\s]*)?$/i

/** `http://<host of the paired desktop endpoint>:8787`, or null when the endpoint has no host. */
export function deriveCcTabdiffBaseUrl(hostEndpoint: string | null | undefined): string | null {
  const host = hostEndpoint ? ENDPOINT_HOST.exec(hostEndpoint.trim())?.[1] : undefined
  return host ? `http://${host}:${CC_TABDIFF_PORT}` : null
}

/** Normalizes a user-typed base URL; null when it is empty or not an http(s) URL. */
export function normalizeCcTabdiffBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return null
  }
  const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `http://${trimmed}`
  const base = withScheme.replace(/\/+$/, '')
  return HTTP_BASE.test(base) ? base : null
}

/** The preference wins when it is a valid URL; otherwise the desktop endpoint's host on port 8787. */
export function resolveCcTabdiffBaseUrl(
  preference: string | null | undefined,
  hostEndpoint: string | null | undefined
): string | null {
  return normalizeCcTabdiffBaseUrl(preference) ?? deriveCcTabdiffBaseUrl(hostEndpoint)
}

/** One Orca tab's diff; `tabId` is the desktop tab id (the pane's ORCA_TAB_ID). */
export function tabDiffUrl(base: string, tabId: string): string {
  return `${base}/t/${encodeURIComponent(tabId)}`
}

export function allDiffsUrl(base: string): string {
  return `${base}/t/_all`
}

export function openMrUrl(base: string, link: string): string {
  return buildDiffViewerUrl(base, link)
}

/** The ORCA_TAB_ID of a mobile terminal tab: its desktop parent tab, whose id prefixes `<tab>::<leaf>`. */
export function orcaTabIdOf(tab: { id: string; parentTabId?: string }): string {
  return tab.parentTabId ?? tab.id.split('::')[0]!
}

/** Same origin as the viewer's base, so in-app navigation stays in the WebView and the rest leaves. */
export function isCcTabdiffUrl(base: string, url: string): boolean {
  const origin = /^https?:\/\/[^/?#]+/i.exec(base)?.[0]
  if (!origin) {
    return false
  }
  const lowerUrl = url.toLowerCase()
  const lowerOrigin = origin.toLowerCase()
  return (
    lowerUrl === lowerOrigin ||
    ['/', '?', '#'].some((sep) => lowerUrl.startsWith(lowerOrigin + sep))
  )
}
