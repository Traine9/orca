import { describe, expect, it } from 'vitest'
import {
  allDiffsUrl,
  deriveCcTabdiffBaseUrl,
  isCcTabdiffUrl,
  isMergeRequestUrl,
  normalizeCcTabdiffBaseUrl,
  openMrUrl,
  orcaTabIdOf,
  resolveCcTabdiffBaseUrl,
  tabDiffUrl
} from './url'

describe('deriveCcTabdiffBaseUrl', () => {
  it('takes the host of the paired desktop endpoint and swaps in port 8787', () => {
    expect(deriveCcTabdiffBaseUrl('ws://192.168.0.3:6768')).toBe('http://192.168.0.3:8787')
    expect(deriveCcTabdiffBaseUrl('wss://desk.tail1234.ts.net:6768/path')).toBe(
      'http://desk.tail1234.ts.net:8787'
    )
    expect(deriveCcTabdiffBaseUrl('ws://[fd7a:115c:a1e0::1]:6768')).toBe(
      'http://[fd7a:115c:a1e0::1]:8787'
    )
  })

  it('returns null without a usable endpoint', () => {
    expect(deriveCcTabdiffBaseUrl(null)).toBeNull()
    expect(deriveCcTabdiffBaseUrl('')).toBeNull()
    expect(deriveCcTabdiffBaseUrl('not a url')).toBeNull()
  })
})

describe('normalizeCcTabdiffBaseUrl', () => {
  it('trims, adds http:// and drops trailing slashes', () => {
    expect(normalizeCcTabdiffBaseUrl(' http://desk:9000/ ')).toBe('http://desk:9000')
    expect(normalizeCcTabdiffBaseUrl('192.168.0.3:8787')).toBe('http://192.168.0.3:8787')
    expect(normalizeCcTabdiffBaseUrl('https://desk.lan:8787/tabdiff//')).toBe(
      'https://desk.lan:8787/tabdiff'
    )
  })

  it('rejects empty and non-http values', () => {
    expect(normalizeCcTabdiffBaseUrl('')).toBeNull()
    expect(normalizeCcTabdiffBaseUrl('   ')).toBeNull()
    expect(normalizeCcTabdiffBaseUrl(undefined)).toBeNull()
    expect(normalizeCcTabdiffBaseUrl('ftp://desk:8787')).toBeNull()
    expect(normalizeCcTabdiffBaseUrl('http://desk lan')).toBeNull()
  })
})

describe('resolveCcTabdiffBaseUrl', () => {
  it('prefers a valid preference over the derived default', () => {
    expect(resolveCcTabdiffBaseUrl('https://desk.lan:8787', 'ws://192.168.0.3:6768')).toBe(
      'https://desk.lan:8787'
    )
  })

  it('falls back to the endpoint when the preference is empty or invalid', () => {
    expect(resolveCcTabdiffBaseUrl('', 'ws://192.168.0.3:6768')).toBe('http://192.168.0.3:8787')
    expect(resolveCcTabdiffBaseUrl('ftp://x', 'ws://192.168.0.3:6768')).toBe(
      'http://192.168.0.3:8787'
    )
    expect(resolveCcTabdiffBaseUrl(null, null)).toBeNull()
  })
})

describe('page URLs', () => {
  const base = 'http://192.168.0.3:8787'

  it('builds the tab, all-tabs and MR pages', () => {
    expect(tabDiffUrl(base, 'tab-1')).toBe('http://192.168.0.3:8787/t/tab-1')
    expect(tabDiffUrl(base, 'a/b c')).toBe('http://192.168.0.3:8787/t/a%2Fb%20c')
    expect(allDiffsUrl(base)).toBe('http://192.168.0.3:8787/t/_all')
    expect(openMrUrl(base, 'https://gitlab.com/g/p/-/merge_requests/7')).toBe(
      'http://192.168.0.3:8787/open?url=https%3A%2F%2Fgitlab.com%2Fg%2Fp%2F-%2Fmerge_requests%2F7'
    )
  })

  it('tells viewer pages from outside links', () => {
    expect(isCcTabdiffUrl(base, 'http://192.168.0.3:8787/t/_all?w=1h')).toBe(true)
    expect(isCcTabdiffUrl(base, 'http://192.168.0.3:8787')).toBe(true)
    expect(isCcTabdiffUrl(base, 'http://192.168.0.3:87870/t/x')).toBe(false)
    expect(isCcTabdiffUrl(base, 'https://gitlab.com/g/p/-/merge_requests/7')).toBe(false)
  })
})

describe('orcaTabIdOf', () => {
  it('uses the desktop parent tab id, which is what ORCA_TAB_ID carries', () => {
    expect(orcaTabIdOf({ id: 'tab-1::pane:2', parentTabId: 'tab-1' })).toBe('tab-1')
  })

  it('falls back to the id prefix before the leaf separator', () => {
    expect(orcaTabIdOf({ id: 'tab-1::pane:2' })).toBe('tab-1')
    expect(orcaTabIdOf({ id: 'tab-1' })).toBe('tab-1')
  })
})

describe('isMergeRequestUrl (shared with the desktop)', () => {
  it('accepts GitLab MRs, GitHub PRs and Bitbucket Cloud PRs only', () => {
    expect(isMergeRequestUrl('https://gitlab.example.com/g/p/-/merge_requests/12')).toBe(true)
    expect(isMergeRequestUrl('https://github.com/o/r/pull/3')).toBe(true)
    expect(isMergeRequestUrl('https://bitbucket.org/w/r/pull-requests/5')).toBe(true)
    expect(isMergeRequestUrl('https://github.com/o/r/issues/3')).toBe(false)
  })
})
