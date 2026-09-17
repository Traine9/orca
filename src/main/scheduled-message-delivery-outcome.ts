import type { ScheduledMessageFailureReason } from '../shared/scheduled-message-types'
import { getTerminalSendGuardRefusedReason } from './runtime/rpc/terminal-agent-send-guard'

/** A pane at a permission prompt is not a failure — the user is mid-decision.
 *  Retry a bounded number of times before calling it failed, so a prompt nobody
 *  ever answers still ends. */
export const MAX_DELIVERY_ATTEMPTS = 3

export type ScheduledMessageDeliveryOutcome =
  /** Leave the message pending and try again on the next tick or idle edge. */
  { kind: 'retry' } | { kind: 'fail'; reason: ScheduledMessageFailureReason; loud: boolean }

/**
 * Map a send-guard rejection to what should happen to the message.
 *
 * Split out of the service so the policy is readable and testable on its own:
 * the guard's error codes are the only contract between "the terminal refused"
 * and "the user sees a failed row".
 */
export function resolveScheduledMessageDeliveryOutcome(
  error: unknown,
  attemptsSoFar: number
): ScheduledMessageDeliveryOutcome {
  switch (getTerminalSendGuardRefusedReason(error)) {
    case 'permission':
      return attemptsSoFar + 1 < MAX_DELIVERY_ATTEMPTS
        ? { kind: 'retry' }
        : { kind: 'fail', reason: 'send-failed', loud: false }
    // The agent took work back up between the idle check and the write. Never a
    // failure: the message keeps its place in the queue and the next idle edge
    // arms it again, which is exactly what `when-idle` promised the user.
    case 'agent-busy':
      return { kind: 'retry' }
    // The guard proved no agent is running. Expected enough not to warrant a
    // console warning — the workspace simply isn't in a state to receive text.
    case 'no-agent':
      return { kind: 'fail', reason: 'no-agent', loud: false }
    // Not a guard refusal at all — the PTY write itself failed. Worth a warning
    // because nothing else in the system explains it.
    case undefined:
      return { kind: 'fail', reason: 'send-failed', loud: true }
  }
}
