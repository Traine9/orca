import {
  MAX_SCHEDULE_HORIZON_MS,
  type ScheduledMessage,
  type ScheduledMessageFailureReason,
  type ScheduledMessageStatus,
  type ScheduledMessageTiming
} from './scheduled-message-types'

// Why normalize on load at all: orca-data.json is a plaintext file on disk, and
// this is the one array whose contents the main process later types into a live
// agent. A hand-edited or downgrade-mangled row must be dropped at the boundary
// rather than surface later as a message sent to nowhere — or worse, a
// non-string `text` reaching the terminal write path.

const STATUSES: readonly ScheduledMessageStatus[] = ['pending', 'missed', 'failed']

const FAILURE_REASONS: readonly ScheduledMessageFailureReason[] = [
  'no-pane',
  'no-agent',
  'send-failed',
  'expired-while-closed',
  'usage-limit-outlasted'
]

function isStatus(value: unknown): value is ScheduledMessageStatus {
  return STATUSES.some((status) => status === value)
}

function isFailureReason(value: unknown): value is ScheduledMessageFailureReason {
  return FAILURE_REASONS.some((reason) => reason === value)
}

function normalizeTiming(value: unknown): ScheduledMessageTiming | null {
  if (typeof value !== 'object' || value === null || !('kind' in value)) {
    return null
  }
  if (value.kind === 'when-idle') {
    return { kind: 'when-idle' }
  }
  if (
    value.kind === 'at' &&
    'sendAt' in value &&
    typeof value.sendAt === 'number' &&
    Number.isFinite(value.sendAt)
  ) {
    return { kind: 'at', sendAt: value.sendAt }
  }
  return null
}

export function normalizeScheduledMessage(value: unknown): ScheduledMessage | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('worktreeId' in value) ||
    !('text' in value) ||
    !('timing' in value) ||
    !('createdAt' in value)
  ) {
    return null
  }
  const timing = normalizeTiming(value.timing)
  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.worktreeId !== 'string' ||
    value.worktreeId.length === 0 ||
    typeof value.text !== 'string' ||
    timing === null ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt)
  ) {
    return null
  }
  // An unknown status reads as pending: the row is still a promise the user made,
  // and refusing to deliver it would be a silent loss.
  const rawStatus = 'status' in value ? value.status : undefined
  const status = isStatus(rawStatus) ? rawStatus : 'pending'
  const rawFailureReason = 'failureReason' in value ? value.failureReason : undefined
  const failureReason = isFailureReason(rawFailureReason) ? rawFailureReason : undefined
  return {
    id: value.id,
    worktreeId: value.worktreeId,
    text: value.text,
    timing,
    createdAt: value.createdAt,
    status,
    ...(status === 'pending' || failureReason === undefined ? {} : { failureReason })
  }
}

/** Drops malformed rows and duplicate ids rather than failing the whole load —
 *  one corrupt entry must not cost the user the rest of their queue. */
export function normalizeScheduledMessages(value: unknown): ScheduledMessage[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const messages: ScheduledMessage[] = []
  for (const entry of value) {
    const message = normalizeScheduledMessage(entry)
    if (message && !seen.has(message.id)) {
      seen.add(message.id)
      messages.push(message)
    }
  }
  return messages
}

export type ScheduledMessageValidationError =
  | 'empty-text'
  | 'send-at-in-past'
  | 'send-at-beyond-horizon'

/** Shared by the compose dialog (to disable Save) and the main-process CRUD (to
 *  reject), so the two can never disagree about what is schedulable. */
export function validateScheduledMessageDraft(
  draft: { text: string; timing: ScheduledMessageTiming },
  now: number
): ScheduledMessageValidationError | null {
  if (draft.text.trim().length === 0) {
    return 'empty-text'
  }
  if (draft.timing.kind === 'at') {
    if (draft.timing.sendAt <= now) {
      return 'send-at-in-past'
    }
    if (draft.timing.sendAt - now > MAX_SCHEDULE_HORIZON_MS) {
      return 'send-at-beyond-horizon'
    }
  }
  return null
}
