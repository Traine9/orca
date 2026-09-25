import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDiffViewerLinkAction,
  registerDiffViewerSettingsAccessor
} from './diff-viewer-link-action'
import { registerHttpLinkStoreAccessor } from './browser/navigation/http-link-routing'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const MR_URL = 'https://gitlab.example.com/group/project/-/merge_requests/42'
const setActiveWorktreeMock = vi.fn()
const createBrowserTabMock = vi.fn()
const openUrlMock = vi.fn()
type TestSettings = {
  diffViewerBaseUrl?: string
  openLinksInApp?: boolean
  ccTabdiffServer?: boolean
}
const initialSettings: TestSettings = {}
const storeState = {
  settings: initialSettings,
  setActiveWorktree: setActiveWorktreeMock,
  createBrowserTab: createBrowserTabMock
}

beforeEach(() => {
  vi.clearAllMocks()
  storeState.settings = {}
  registerHttpLinkStoreAccessor(() => storeState)
  registerDiffViewerSettingsAccessor(() => storeState.settings)
  vi.stubGlobal('window', { api: { shell: { openUrl: openUrlMock } } })
  vi.stubGlobal('navigator', { userAgent: 'Node.js' })
})

describe('buildDiffViewerLinkAction', () => {
  it('is absent when no settings accessor is registered', () => {
    registerDiffViewerSettingsAccessor(null)
    storeState.settings = { diffViewerBaseUrl: 'http://192.168.0.3:8787' }
    expect(buildDiffViewerLinkAction(MR_URL, 'wt-1')).toBeUndefined()
  })

  it('is absent when no diff viewer URL is configured', () => {
    storeState.settings = { diffViewerBaseUrl: '   ' }
    expect(buildDiffViewerLinkAction(MR_URL, 'wt-1')).toBeUndefined()
  })

  it('falls back to the built-in cc-tabdiff server on the Linux desktop', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })
    const action = buildDiffViewerLinkAction(MR_URL, 'wt-1')
    void action?.run()
    expect(createBrowserTabMock).toHaveBeenCalledWith(
      'wt-1',
      `http://127.0.0.1:8787/open?url=${encodeURIComponent(MR_URL)}`,
      { activate: true }
    )
    storeState.settings = { ccTabdiffServer: false }
    expect(buildDiffViewerLinkAction(MR_URL, 'wt-1')).toBeUndefined()
  })

  it('is absent for links that are not merge/pull requests', () => {
    storeState.settings = { diffViewerBaseUrl: 'http://192.168.0.3:8787' }
    expect(buildDiffViewerLinkAction('https://github.com/o/r/issues/1', 'wt-1')).toBeUndefined()
  })

  it('opens the diff viewer in the Orca browser even when links default to the system browser', () => {
    storeState.settings = { diffViewerBaseUrl: 'http://192.168.0.3:8787/', openLinksInApp: false }
    const action = buildDiffViewerLinkAction(MR_URL, 'wt-1')
    expect(action?.label).toBe('Diff viewer')
    expect(action?.external).toBe(false)

    void action?.run()

    expect(createBrowserTabMock).toHaveBeenCalledWith(
      'wt-1',
      `http://192.168.0.3:8787/open?url=${encodeURIComponent(MR_URL)}`,
      { activate: true }
    )
    expect(openUrlMock).not.toHaveBeenCalled()
  })
})
