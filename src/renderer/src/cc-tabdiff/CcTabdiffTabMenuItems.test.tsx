/**
 * @vitest-environment happy-dom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CcTabdiffTabMenuItems } from './CcTabdiffTabMenuItems'

const mocks = vi.hoisted(() => {
  const settings: Record<string, unknown> = {}
  return { openHttpLink: vi.fn(), settings }
})

vi.mock('@/lib/browser/navigation/http-link-routing', () => ({ openHttpLink: mocks.openHttpLink }))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: { settings: Record<string, unknown> }) => unknown) =>
    selector({ settings: mocks.settings })
}))

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenuSeparator: () => <hr />,
  ContextMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  )
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

let container: HTMLDivElement
let root: Root

function render(): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(<CcTabdiffTabMenuItems tabId="tab-42" worktreeId="wt-1" />)
  })
}

function clickButton(label: string): void {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === label)
  expect(button).toBeDefined()
  act(() => button?.click())
}

beforeEach(() => {
  mocks.openHttpLink.mockClear()
  mocks.settings = {}
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('CcTabdiffTabMenuItems', () => {
  it('opens this tab diff and the tab list from the built-in server in the Orca browser', () => {
    render()
    clickButton('Open tab diff')
    expect(mocks.openHttpLink).toHaveBeenLastCalledWith('http://127.0.0.1:8787/t/tab-42', {
      worktreeId: 'wt-1',
      forceInApp: true,
      sourceOwner: { kind: 'local' }
    })
    clickButton('All tab diffs')
    expect(mocks.openHttpLink).toHaveBeenLastCalledWith(
      'http://127.0.0.1:8787/',
      expect.objectContaining({ worktreeId: 'wt-1', forceInApp: true })
    )
  })

  it('uses the configured Diff viewer URL', () => {
    mocks.settings = { diffViewerBaseUrl: 'http://192.168.0.3:9000/' }
    render()
    clickButton('Open tab diff')
    expect(mocks.openHttpLink).toHaveBeenLastCalledWith(
      'http://192.168.0.3:9000/t/tab-42',
      expect.anything()
    )
  })

  it('renders nothing when no viewer is configured or running', () => {
    mocks.settings = { ccTabdiffServer: false }
    render()
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})
