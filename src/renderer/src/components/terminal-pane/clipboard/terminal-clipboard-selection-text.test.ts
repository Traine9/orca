import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'

const settings: { current: Partial<GlobalSettings> } = { current: {} }
vi.mock('@/store/index', () => ({
  useAppStore: { getState: () => ({ settings: settings.current }) }
}))

const { readTerminalClipboardSelection } = await import('./terminal-clipboard-selection-text')
const { setTerminalAgentOutputProbe } = await import('./terminal-agent-output-probe')

const WRAPPED = ['  Retry limit is now five and the', '  backoff starts at 2s.'].join('\n')

function terminal(agent: boolean) {
  const t = {
    getSelection: () => WRAPPED,
    getSelectionPosition: () => ({ start: { x: 0, y: 0 }, end: { x: 23, y: 1 } }),
    cols: 34
  }
  setTerminalAgentOutputProbe(t, () => agent)
  return t
}

describe('readTerminalClipboardSelection', () => {
  beforeEach(() => {
    settings.current = {}
  })

  it('joins hard-wrapped rows only in a pane that runs an agent', () => {
    expect(readTerminalClipboardSelection(terminal(true))).toBe(
      'Retry limit is now five and the backoff starts at 2s.'
    )
    expect(readTerminalClipboardSelection(terminal(false))).toBe(
      ['Retry limit is now five and the', 'backoff starts at 2s.'].join('\n')
    )
  })

  it('copies screen cells verbatim when the setting is off', () => {
    settings.current = { terminalCopyTrimsGutter: false }
    expect(readTerminalClipboardSelection(terminal(true))).toBe(WRAPPED)
  })
})
