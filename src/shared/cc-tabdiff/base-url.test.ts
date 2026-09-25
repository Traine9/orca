import { describe, expect, it } from 'vitest'
import {
  buildCcTabdiffIndexUrl,
  buildCcTabdiffTabUrl,
  CC_TABDIFF_DEFAULT_BASE_URL,
  resolveCcTabdiffBaseUrl
} from './base-url'

describe('resolveCcTabdiffBaseUrl', () => {
  it('prefers the configured URL, without trailing slashes', () => {
    expect(resolveCcTabdiffBaseUrl({ diffViewerBaseUrl: ' http://desk:9000/ ' }, false)).toBe(
      'http://desk:9000'
    )
  })

  it('falls back to the built-in server when it is available and on (default on)', () => {
    expect(resolveCcTabdiffBaseUrl({ diffViewerBaseUrl: '' }, true)).toBe(
      CC_TABDIFF_DEFAULT_BASE_URL
    )
    expect(resolveCcTabdiffBaseUrl(undefined, true)).toBe('http://127.0.0.1:8787')
  })

  it('is empty when the built-in server is off or unavailable and no URL is set', () => {
    expect(resolveCcTabdiffBaseUrl({ ccTabdiffServer: false }, true)).toBe('')
    expect(resolveCcTabdiffBaseUrl({ ccTabdiffServer: true }, false)).toBe('')
  })
})

describe('cc-tabdiff page URLs', () => {
  it('builds the tab and index pages', () => {
    expect(buildCcTabdiffTabUrl('http://h:8787/', 'tab 1/x')).toBe('http://h:8787/t/tab%201%2Fx')
    expect(buildCcTabdiffIndexUrl('http://h:8787//')).toBe('http://h:8787/')
  })
})
