import type {
  ScheduledMessage,
  ScheduledMessageFailureReason,
  ScheduledMessagesSnapshot
} from '../shared/scheduled-message-types'

/** The ports ScheduledMessageService is wired through, kept beside the service
 *  rather than inside it: the composition root and the tests both read this to
 *  know what the service is allowed to touch, and neither needs the delivery
 *  machinery loaded to do so. */

/** How long to let a `when-idle` edge settle before delivering. Some CLIs blip
 *  through idle between tool calls; the guard would catch it anyway, but waiting
 *  avoids racing the next `working` title on every such blip. */
export const IDLE_EDGE_SETTLE_MS = 3_000

export type ScheduledMessageNotification = {
  kind: 'sent' | 'missed' | 'failed'
  worktreeId: string
  messageId: string
  failureReason?: ScheduledMessageFailureReason
}

/** Where a message should be typed, resolved at delivery time rather than when
 *  the user composed it — panes die and are replaced across a wait of hours. */
export type ScheduledMessagePaneTarget = {
  handle: string
  ptyId: string | null
}

type ScheduledMessageStore = {
  listScheduledMessages: () => ScheduledMessage[]
  putScheduledMessage: (message: ScheduledMessage) => void
  deleteScheduledMessage: (messageId: string) => void
}

export type ScheduledMessageServiceOptions = {
  store: ScheduledMessageStore
  /** Find a live pane running an agent for this workspace, or null if none. */
  resolveAgentPane: (worktreeId: string) => Promise<ScheduledMessagePaneTarget | null>
  /** Guarded write into an agent pane. Rejects rather than typing into a shell. */
  deliver: (handle: string, text: string) => Promise<void>
  /** True while the pane is sitting on a provider usage-limit banner or menu, in
   *  which case delivery must defer. On a menu it also selects "stop and wait for
   *  limit to reset" on the way past, which is why this is one call and not a
   *  query plus an action: the pane's tail is then read once, not twice.
   *
   *  Going through this — rather than sharing state with AgentAutoResumeService —
   *  is what keeps the two features from typing over each other. */
  deferForUsageLimit: (ptyId: string, handle: string) => Promise<boolean>
  /** Whether the workspace's agent is idle *right now*. Only consulted for
   *  `when-idle` delivery, where the edge that armed the settle timer is seconds
   *  old by the time it fires and the user may have typed since. Without it
   *  "send when idle" degrades into "send shortly after it was idle once". */
  isAgentIdle?: (pane: ScheduledMessagePaneTarget) => Promise<boolean>
  createId: () => string
  notify?: (notification: ScheduledMessageNotification) => void
  onSnapshot?: (snapshot: ScheduledMessagesSnapshot) => void
  tickMs?: number
  missedGraceMs?: number
  maxUsageLimitWaitMs?: number
  idleSettleMs?: number
  now?: () => number
  logger?: Pick<Console, 'debug' | 'warn'>
}
