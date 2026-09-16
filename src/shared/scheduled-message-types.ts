// Why a separate module from agent-auto-resume-types: both features write into
// a live agent pane, but they answer to different owners. Auto-resume reacts to
// the provider; a scheduled message is something the user authored and expects
// to survive quitting the app. Sharing a type here would tempt sharing the
// in-memory-only lifecycle, which is exactly what must NOT be shared.

/** When a scheduled message should be delivered.
 *  - `at`: wall-clock ms epoch, the Telegram "pick a date and time" case.
 *  - `when-idle`: deliver as soon as the workspace's agent stops working, the
 *    analogue of Telegram's "Send when online". Prevents cutting into a turn
 *    that is still in progress, which would interleave with the agent's own
 *    prompt and usually get swallowed. */
export type ScheduledMessageTiming = { kind: 'at'; sendAt: number } | { kind: 'when-idle' }

/** Why failures persist instead of being dropped: the user authored this text
 *  and is entitled to know it did not arrive. A row that stays visible with a
 *  reason is the asynchronous form of asking them what to do about it. */
export type ScheduledMessageStatus = 'pending' | 'missed' | 'failed'

export type ScheduledMessageFailureReason =
  /** The due moment arrived with no live terminal in the workspace. */
  | 'no-pane'
  /** A terminal existed but no recognized agent was running in it. */
  | 'no-agent'
  /** The agent was there and the send itself was rejected or errored. */
  | 'send-failed'
  /** Orca was closed past the late-delivery grace window. */
  | 'expired-while-closed'
  /** The pane's usage limit outlasted the maximum wait, so the message was never
   *  typed. Distinct from `expired-while-closed`: Orca was running the whole
   *  time and deliberately holding the message back. */
  | 'usage-limit-outlasted'

/** One user-authored message queued for a workspace's agent.
 *
 *  Stored flat in PersistedState (not on WorktreeMeta) for two reasons. First,
 *  the Automations tab lists these across every workspace, and worktree metadata
 *  is only reachable per-worktree through three differently-shaped sources.
 *  Second, meta travels as one opaque array through a read-modify-write RPC: a
 *  user editing one message while the service deletes another loses a write.
 *  Flat rows with a main-process owner serialize those two writers. */
export type ScheduledMessage = {
  /** Stable id so edit/delete can address one entry without index drift. */
  id: string
  /** Owning workspace. Required now that rows no longer live under one. */
  worktreeId: string
  text: string
  timing: ScheduledMessageTiming
  createdAt: number
  status: ScheduledMessageStatus
  /** Set only alongside a 'missed'/'failed' status. */
  failureReason?: ScheduledMessageFailureReason
}

/** What the user supplies to create a message; main assigns the rest.
 *  Declared here because all four layers — renderer dialog, preload bridge, IPC
 *  handler, service — take this exact shape and must not drift. */
export type ScheduledMessageDraft = {
  worktreeId: string
  text: string
  timing: ScheduledMessageTiming
}

/** An edit. Both fields optional: the Automations row can change either alone,
 *  and supplying a future `timing` is also the reschedule path for a
 *  missed/failed row. */
export type ScheduledMessageChanges = {
  text?: string
  timing?: ScheduledMessageTiming
}

/** Telegram caps a chat at 100 pending messages; the same ceiling keeps a
 *  runaway script from turning the persisted state file into a spool. */
export const MAX_SCHEDULED_MESSAGES_PER_WORKSPACE = 100

/** Telegram allows scheduling up to a year out. Past this the wall-clock timer
 *  is more likely to be a typo than an intent. */
export const MAX_SCHEDULE_HORIZON_MS = 365 * 24 * 60 * 60 * 1000

/** How late a due message may still be delivered silently. Covers ordinary tick
 *  jitter and short restarts. Past it, Orca refuses to send: unlike a chat
 *  recipient, an agent's context has moved on, and a stale prompt landing hours
 *  later can answer a question nobody is asking any more. */
export const SCHEDULED_MESSAGE_MISSED_GRACE_MS = 10 * 60 * 1000

/** Ceiling on how long a due message may wait out a provider usage limit. Covers
 *  a 5-hour session window with room for a late reset and an overnight sleep. A
 *  weekly limit outlasts it — deliberately: by then the agent's context is as
 *  gone as it would be after a long shutdown, so the row is surfaced to the user
 *  instead of typed in a day late with nobody watching. */
export const SCHEDULED_MESSAGE_MAX_USAGE_LIMIT_WAIT_MS = 12 * 60 * 60 * 1000

/** Why a coarse tick rather than one timer per message: the one-year horizon is
 *  far past setTimeout's ~24.8 day ceiling, where a delay silently overflows to
 *  firing immediately. Scanning is also what survives sleep/suspend. */
export const SCHEDULED_MESSAGE_TICK_MS = 30 * 1000

/** Full-list push, mirroring the auto-resume snapshot channel. Sending the whole
 *  set rather than per-message deltas keeps the renderer a pure mirror of
 *  main-owned state, so a dropped event cannot desynchronize the tab. */
export type ScheduledMessagesSnapshot = {
  messages: ScheduledMessage[]
}

export const SCHEDULED_MESSAGES_UPDATE_CHANNEL = 'scheduledMessages:update'
