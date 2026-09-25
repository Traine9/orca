// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScheduledMessageComposeDialog } from './ScheduledMessageComposeDialog'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

afterEach(cleanup)

const AT_TIME_HINT = 'Sends at that time even if the agent is mid-task, interrupting it.'
const WHEN_IDLE_HINT = 'Delivers the next time this workspace’s agent finishes working.'

function precedes(first: Node, second: Node): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('ScheduledMessageComposeDialog timing hints', () => {
  it('puts each hint under the option it describes', () => {
    render(<ScheduledMessageComposeDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />)
    const idleOption = screen.getByText('When the agent is idle')

    expect(precedes(screen.getByText(AT_TIME_HINT), idleOption)).toBe(true)
    expect(screen.queryByText(WHEN_IDLE_HINT)).toBeNull()

    fireEvent.click(screen.getByLabelText('When the agent is idle'))

    expect(screen.queryByText(AT_TIME_HINT)).toBeNull()
    expect(precedes(idleOption, screen.getByText(WHEN_IDLE_HINT))).toBe(true)
  })
})
