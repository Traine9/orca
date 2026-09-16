import type { ScheduledMessage } from '../../../shared/scheduled-message-types'
import type { PersistedState } from '../../../shared/persisted-state-types'
import type { StoreRuntimeState } from './store-runtime-state'
import type { WriteSchedulingOperations } from './write-scheduling'
import { scheduleSave } from './write-scheduling'

type ScheduledMessagePersistenceRuntime = Pick<StoreRuntimeState, 'state'>

const scheduledMessagePersistenceContext = Symbol('ScheduledMessagePersistence')
type ScheduledMessagePersistenceContext = {
  runtime: ScheduledMessagePersistenceRuntime
  scheduling: WriteSchedulingOperations
}

/** Shared with removeWorktreeMeta, which sweeps in a pass that already schedules a save. */
export function dropScheduledMessagesForWorktree(
  state: PersistedState,
  worktreeId: string
): boolean {
  const existing = state.scheduledMessages ?? []
  const remaining = existing.filter((entry) => entry.worktreeId !== worktreeId)
  if (remaining.length === existing.length) {
    return false
  }
  state.scheduledMessages = remaining
  return true
}

export class ScheduledMessagePersistence {
  readonly [scheduledMessagePersistenceContext]: ScheduledMessagePersistenceContext

  constructor(runtime: ScheduledMessagePersistenceRuntime, scheduling: WriteSchedulingOperations) {
    this[scheduledMessagePersistenceContext] = { runtime, scheduling }
  }

  listScheduledMessages(): ScheduledMessage[] {
    return this[scheduledMessagePersistenceContext].runtime.state.scheduledMessages ?? []
  }

  /** Insert or replace by id. The service is the only caller, so last write wins
   *  is safe here in a way it is not for a renderer-supplied whole array. */
  putScheduledMessage(message: ScheduledMessage): void {
    const { runtime, scheduling } = this[scheduledMessagePersistenceContext]
    const existing = runtime.state.scheduledMessages ?? []
    const index = existing.findIndex((entry) => entry.id === message.id)
    runtime.state.scheduledMessages =
      index === -1
        ? [...existing, message]
        : [...existing.slice(0, index), message, ...existing.slice(index + 1)]
    scheduleSave(scheduling)
  }

  deleteScheduledMessage(messageId: string): void {
    const { runtime, scheduling } = this[scheduledMessagePersistenceContext]
    const existing = runtime.state.scheduledMessages ?? []
    const remaining = existing.filter((entry) => entry.id !== messageId)
    if (remaining.length === existing.length) {
      return
    }
    runtime.state.scheduledMessages = remaining
    scheduleSave(scheduling)
  }

  deleteScheduledMessagesForWorktree(worktreeId: string): void {
    const { runtime, scheduling } = this[scheduledMessagePersistenceContext]
    if (dropScheduledMessagesForWorktree(runtime.state, worktreeId)) {
      scheduleSave(scheduling)
    }
  }
}

export function installScheduledMessagePersistenceContext(
  target: object,
  source: ScheduledMessagePersistence
): void {
  Object.defineProperty(target, scheduledMessagePersistenceContext, {
    value: source[scheduledMessagePersistenceContext]
  })
}
