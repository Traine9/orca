import type { StateCreator } from 'zustand'
import type {
  ScheduledMessage,
  ScheduledMessagesSnapshot
} from '../../../../shared/scheduled-message-types'
import type { AppState } from '../types'

// Why: main owns the queue and pushes the whole list on every change; the
// renderer is a pure mirror. Intents (add/update/delete/sendNow) go straight to
// the preload API rather than through the store, so a renderer edit can never
// race the delivery service's removal.
export type ScheduledMessagesSlice = {
  scheduledMessages: ScheduledMessage[]
  setScheduledMessagesSnapshot: (snapshot: ScheduledMessagesSnapshot) => void
}

export const createScheduledMessagesSlice: StateCreator<
  AppState,
  [],
  [],
  ScheduledMessagesSlice
> = (set) => ({
  scheduledMessages: [],
  setScheduledMessagesSnapshot: (snapshot) => set({ scheduledMessages: snapshot.messages })
})

const NO_MESSAGES: ScheduledMessage[] = []

export function selectScheduledMessagesForWorktree(
  state: Pick<ScheduledMessagesSlice, 'scheduledMessages'>,
  worktreeId: string
): ScheduledMessage[] {
  const messages = (state.scheduledMessages ?? []).filter(
    (message) => message.worktreeId === worktreeId
  )
  // Why a shared empty array: this runs per card on every store change, and a
  // fresh [] each time would defeat the sidebar's referential-equality checks.
  return messages.length === 0 ? NO_MESSAGES : messages
}

export function selectPendingScheduledCount(
  state: Pick<ScheduledMessagesSlice, 'scheduledMessages'>,
  worktreeId: string
): number {
  let count = 0
  for (const message of state.scheduledMessages ?? []) {
    if (message.worktreeId === worktreeId && message.status === 'pending') {
      count += 1
    }
  }
  return count
}

/** A workspace with a missed or failed row needs the user's attention, which the
 *  card badge renders differently from a plain pending count. */
export function selectHasScheduledMessageProblem(
  state: Pick<ScheduledMessagesSlice, 'scheduledMessages'>,
  worktreeId: string
): boolean {
  return (state.scheduledMessages ?? []).some(
    (message) => message.worktreeId === worktreeId && message.status !== 'pending'
  )
}
