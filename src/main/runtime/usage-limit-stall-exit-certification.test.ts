/**
 * A usage-limit stall outlives its PTY record, so the exit handler is the only
 * place that can tell the watcher "this one is not coming back". It must say so
 * on a real death certificate and stay quiet without one: an uncertified exit —
 * a synthetic -1 from a failed stop, a dropped SSH relay — leaves an agent that
 * is still parked at the same limit, and a false "exited" both notifies the user
 * about a pane that returns and drops a stall nothing will detect again (a
 * parked agent prints nothing on reconnect).
 */
import { describe, expect, it } from 'vitest'
import { OrcaRuntimeService } from './orca-runtime'
import { makePaneKey } from '../../shared/stable-pane-id'
import type { UsageLimitStallEvent } from './runtime-usage-limit-stall-contracts'

const LEAF = '11111111-1111-4111-8111-111111111111'
const PANE = makePaneKey('tab-1', LEAF)
const PTY = 'wt-1__pty-1'

// Only the fields the exit path reads; the real PtyRecord is internal.
type SeededPtyRecord = {
  ptyId: string
  paneKey: string
  worktreeId: string
  tabId: string
  usageLimitStall: { reason: string; resetsAt: number }
  connectionId?: string
}

type RuntimeInternals = {
  ptysById: Map<string, SeededPtyRecord>
}

function runtimeWithStalledPane(options: { connectionId?: string } = {}): {
  runtime: OrcaRuntimeService
  events: UsageLimitStallEvent[]
} {
  const runtime = new OrcaRuntimeService(null)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the pty record is protected runtime state with no seeding API; spawning a real PTY to reach one stalled mid-limit is not something a unit test can do.
  const ptys = (runtime as unknown as RuntimeInternals).ptysById
  ptys.set(PTY, {
    ptyId: PTY,
    paneKey: PANE,
    worktreeId: 'wt-1',
    tabId: 'tab-1',
    usageLimitStall: { reason: 'usage-limit-banner', resetsAt: Date.now() + 60_000 },
    ...(options.connectionId ? { connectionId: options.connectionId } : {})
  })
  const events: UsageLimitStallEvent[] = []
  runtime.subscribeUsageLimitStall((event) => events.push(event))
  return { runtime, events }
}

describe('usage-limit stall on PTY exit', () => {
  it('reports the stall as exited on a normal zero exit code', () => {
    const { runtime, events } = runtimeWithStalledPane()
    runtime.onPtyExit(PTY, 0)

    expect(events).toContainEqual(expect.objectContaining({ kind: 'exited', ptyId: PTY }))
  })

  it('reports a physical -1 exit witnessed by the provider callback', () => {
    // node-pty forwards real exits as -1, so the numeric code alone cannot
    // separate a dead process from a stop that never landed.
    const { runtime, events } = runtimeWithStalledPane()
    runtime.onPtyExit(PTY, -1, undefined, { providerExitObserved: true })

    expect(events).toContainEqual(expect.objectContaining({ kind: 'exited', ptyId: PTY }))
  })

  it('stays silent on a synthetic -1 from a failed stop', () => {
    const { runtime, events } = runtimeWithStalledPane()
    runtime.onPtyExit(PTY, -1)

    expect(events).toEqual([])
  })

  it('stays silent on an SSH relay drop, whose remote agent is still parked', () => {
    const { runtime, events } = runtimeWithStalledPane({ connectionId: 'ssh-conn-1' })
    runtime.onPtyExit(PTY, -1)

    expect(events).toEqual([])
  })

  it('reports an SSH-bound pane whose provider witnessed the process die', () => {
    // The preserved reconnect surface and the death certificate are independent:
    // the transport may keep the pane addressable while the provider's own exit
    // callback has already seen the process go.
    const { runtime, events } = runtimeWithStalledPane({ connectionId: 'ssh-conn-1' })
    runtime.onPtyExit(PTY, -1, undefined, { providerExitObserved: true })

    expect(events).toContainEqual(expect.objectContaining({ kind: 'exited', ptyId: PTY }))
  })
})
