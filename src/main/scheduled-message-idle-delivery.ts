import type { ScheduledMessage } from '../shared/scheduled-message-types'
import type { ScheduledMessagePaneTarget } from './scheduled-message-service-contracts'

/** The `when-idle` half of scheduling: which queued message an idle edge belongs
 *  to, and the settle timer that lets the edge prove it was not a blip.
 *
 *  Separate from the service because it answers a different question — the tick
 *  asks "is it time yet", this asks "is the agent free yet" — and because the
 *  timers here are per-message state the CRUD paths must be able to cancel. */

/** Oldest first: the queue is FIFO, and only one message goes per edge so each
 *  gets its own agent turn instead of being concatenated into one. */
export function pickNextIdleMessage(
  messages: ScheduledMessage[],
  worktreeId: string
): ScheduledMessage | undefined {
  return messages
    .filter(
      (message) =>
        message.worktreeId === worktreeId &&
        message.status === 'pending' &&
        message.timing.kind === 'when-idle'
    )
    .sort((a, b) => a.createdAt - b.createdAt)[0]
}

/** Re-reads the agent's status when a settle timer fires, since the edge that
 *  armed it is seconds old by then.
 *
 *  Fails open: an unreadable status is not evidence the agent is busy, and
 *  refusing on it would strand the message until an edge that may never come.
 *  The send guard still refuses a permission prompt or a plain shell. */
export async function confirmAgentStillIdle(
  isAgentIdle: ((pane: ScheduledMessagePaneTarget) => Promise<boolean>) | undefined,
  pane: ScheduledMessagePaneTarget,
  logger: Pick<Console, 'debug'>
): Promise<boolean> {
  if (!isAgentIdle) {
    return true
  }
  try {
    return await isAgentIdle(pane)
  } catch (error) {
    logger.debug('[scheduled-messages] idle re-check failed', { error })
    return true
  }
}

export class ScheduledMessageIdleTimers {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

  has(messageId: string): boolean {
    return this.timers.has(messageId)
  }

  /** Fires `onSettled` once the edge has held for `settleMs`. */
  arm(messageId: string, settleMs: number, onSettled: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(messageId)
      onSettled()
    }, settleMs)
    if (typeof timer.unref === 'function') {
      timer.unref()
    }
    this.timers.set(messageId, timer)
  }

  clear(messageId: string): void {
    const timer = this.timers.get(messageId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(messageId)
    }
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }
}
