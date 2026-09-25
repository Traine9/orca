// Host-agnostic so self-hosted GitLab, GitHub Enterprise and Bitbucket Server links match too.
const MERGE_REQUEST_PATH_PATTERNS: readonly RegExp[] = [
  // GitLab: /group/project/-/merge_requests/N (older instances omit the "-/").
  /^\/.+\/(?:-\/)?merge_requests\/\d+(?:\/.*)?$/,
  // GitHub: /owner/repo/pull/N
  /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/.*)?$/,
  // Bitbucket Cloud (/ws/repo/pull-requests/N) and Server (/projects/P/repos/R/pull-requests/N).
  /^\/.+\/pull-requests\/\d+(?:\/.*)?$/
]

export function isMergeRequestUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }
  return MERGE_REQUEST_PATH_PATTERNS.some((pattern) => pattern.test(parsed.pathname))
}

export function buildDiffViewerUrl(baseUrl: string, mrUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return `${base}/open?url=${encodeURIComponent(mrUrl)}`
}
