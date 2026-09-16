import type { ScheduledMessage } from '../shared/scheduled-message-types'

/** The `at` half of scheduling: which rows the coarse tick has reached.
 *
 *  flatMap rather than filter so `sendAt` is narrowed out of the timing union
 *  here, and the caller — which needs the due moment to measure lateness against
 *  the grace window — does not need an unreachable fallback to read it. */
export function pickDueMessages(
  messages: ScheduledMessage[],
  now: number
): { message: ScheduledMessage; sendAt: number }[] {
  return messages.flatMap((message) =>
    message.status === 'pending' && message.timing.kind === 'at' && message.timing.sendAt <= now
      ? [{ message, sendAt: message.timing.sendAt }]
      : []
  )
}
