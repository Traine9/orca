import { describe, expect, it, vi } from 'vitest'
import type { ActionSheetAction } from '../components/ActionSheetModal'
import {
  ccTabdiffHeaderActions,
  ccTabdiffTerminalActions,
  ccTabdiffHostActions
} from './sheet-actions'

const openCcTabdiff = vi.hoisted(() => vi.fn())
vi.mock('./navigation', () => ({ openCcTabdiff }))
vi.mock('lucide-react-native', () => ({}))

const terminalTab = { type: 'terminal', id: 'tab-1::pane:1', parentTabId: 'tab-1' }

async function press(action: ActionSheetAction | undefined) {
  action?.onPress()
  await vi.waitFor(() => expect(openCcTabdiff).toHaveBeenCalled())
}

describe('ccTabdiffTerminalActions', () => {
  it('opens the pressed tab by its desktop tab id', async () => {
    openCcTabdiff.mockClear()
    const actions = ccTabdiffTerminalActions(terminalTab)
    expect(actions.map((action) => action.label)).toEqual(['Open diff'])
    await press(actions[0])
    expect(openCcTabdiff).toHaveBeenCalledWith(undefined, { tab: 'tab-1' })
  })

  it('adds nothing for a terminal without a session tab', () => {
    expect(ccTabdiffTerminalActions(undefined)).toEqual([])
  })
})

describe('ccTabdiffHeaderActions', () => {
  it('offers the active terminal tab and all tabs on this host', async () => {
    openCcTabdiff.mockClear()
    const actions = ccTabdiffHeaderActions({ hostId: 'host-1', activeSessionTab: terminalTab })
    expect(actions.map((action) => action.label)).toEqual(['Open diff', 'All diffs'])
    await press(actions[1])
    expect(openCcTabdiff).toHaveBeenCalledWith('host-1', undefined)
  })

  it('offers only all tabs when the active tab is not a terminal', () => {
    const actions = ccTabdiffHeaderActions({
      hostId: 'host-1',
      activeSessionTab: { type: 'markdown', id: 'md-1' }
    })
    expect(actions.map((action) => action.label)).toEqual(['All diffs'])
  })
})

describe('ccTabdiffHostActions', () => {
  it('opens every tab on the pressed host', async () => {
    openCcTabdiff.mockClear()
    const actions = ccTabdiffHostActions({ id: 'host-1' })
    expect(actions.map((action) => action.label)).toEqual(['All diffs'])
    await press(actions[0])
    expect(openCcTabdiff).toHaveBeenCalledWith('host-1', undefined)
  })

  it('adds nothing without a host', () => {
    expect(ccTabdiffHostActions(null)).toEqual([])
  })
})
