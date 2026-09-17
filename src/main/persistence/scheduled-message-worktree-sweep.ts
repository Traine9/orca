import type { PersistedState } from '../../shared/persisted-state-types'

/**
 * Scheduled messages name a workspace but live outside `worktreeMeta`, so every path
 * that deletes a workspace's metadata has to sweep them as well. A row left behind
 * fails loudly at its due time (`no-pane`) or, for `when-idle`, waits forever on an
 * edge no surviving pane can emit.
 *
 * A leaf module on purpose: the prune paths sit under `tracking-repos`, which the
 * store's own runtime imports, so the sweep may not reach back into the store.
 */
export function dropScheduledMessagesForWorktree(
  state: PersistedState,
  worktreeId: string
): boolean {
  return dropScheduledMessagesWhere(state, (id) => id === worktreeId)
}

export function dropScheduledMessagesWhere(
  state: PersistedState,
  matches: (worktreeId: string) => boolean
): boolean {
  const existing = state.scheduledMessages ?? []
  const remaining = existing.filter((entry) => !matches(entry.worktreeId))
  if (remaining.length === existing.length) {
    return false
  }
  state.scheduledMessages = remaining
  return true
}
