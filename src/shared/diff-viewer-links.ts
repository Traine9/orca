// Mirrors the diff viewer's own parser: GitLab and GitHub on any host, Bitbucket on bitbucket.org
// only. Bitbucket Server (/projects/K/repos/R/pull-requests/N) is rejected there, so it is not offered.
const GITLAB_MR_PATH = /^\/.+\/(?:-\/)?merge_requests\/0*[1-9]\d*(?:\/.*)?$/
const GITHUB_PR_PATH = /^\/[^/]+\/[^/]+\/pull\/0*[1-9]\d*(?:\/.*)?$/
const BITBUCKET_CLOUD_PR_PATH = /^\/[^/]+\/[^/]+\/pull-requests\/0*[1-9]\d*(?:\/.*)?$/

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
  const host = parsed.hostname.toLowerCase()
  const path = parsed.pathname
  if (host === 'bitbucket.org') {
    return BITBUCKET_CLOUD_PR_PATH.test(path)
  }
  if (host === 'github.com' || host === 'www.github.com') {
    return GITHUB_PR_PATH.test(path)
  }
  return GITLAB_MR_PATH.test(path) || GITHUB_PR_PATH.test(path)
}

export function buildDiffViewerUrl(baseUrl: string, mrUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  return `${base}/open?url=${encodeURIComponent(mrUrl)}`
}
