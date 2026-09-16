import { randomUUID } from 'node:crypto'
import { ScheduledMessageService } from '../scheduled-message-service'
import { deliverScheduledMessageNotification } from '../scheduled-message-notifications'
import { SCHEDULED_MESSAGES_UPDATE_CHANNEL } from '../../shared/scheduled-message-types'
import {
  chooseUsageLimitReset,
  resolveWorktreeAgentPane,
  sendGuardedAgentPrompt
} from '../runtime/agent-pane-delivery'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { mainProcessState as state } from './main-process-state'
import { focusWorktreeFromMain } from './main-window-actions'

export function initializeMainProcessScheduledMessages(
  runtimeService: OrcaRuntimeService
): ScheduledMessageService {
  const activeStore = state.store
  if (!activeStore) {
    throw new Error('Store must be initialized before the scheduled-message service')
  }
  const service = new ScheduledMessageService({
    store: {
      listScheduledMessages: () => activeStore.listScheduledMessages(),
      putScheduledMessage: (message) => activeStore.putScheduledMessage(message),
      deleteScheduledMessage: (messageId) => activeStore.deleteScheduledMessage(messageId)
    },
    resolveAgentPane: (worktreeId) => resolveWorktreeAgentPane(runtimeService, worktreeId),
    deliver: (handle, text) => sendGuardedAgentPrompt(runtimeService, handle, text),
    deferForUsageLimit: async (ptyId, handle) => {
      const snapshot = runtimeService.getUsageLimitStallSnapshot(ptyId)
      if (snapshot === null || !snapshot.blocksDelivery) {
        return false
      }
      // Defer on anything that blocks, but only press keys at a chooser we can
      // actually read: on an illegible screen a blind Enter would confirm
      // whichever row the CLI has highlighted, and one of them costs money.
      if (snapshot.reason === 'usage-limit-menu' && snapshot.actionable) {
        await chooseUsageLimitReset(runtimeService, ptyId, handle, snapshot.waitText)
      }
      return true
    },
    createId: () => randomUUID(),
    notify: (notification) =>
      deliverScheduledMessageNotification(notification, {
        getNotificationSettings: () => activeStore.getSettings().notifications,
        focus: (worktreeId) => focusWorktreeFromMain(worktreeId)
      }),
    onSnapshot: (snapshot) =>
      state.mainWindow?.webContents.send(SCHEDULED_MESSAGES_UPDATE_CHANNEL, snapshot)
  })
  state.unsubscribeAgentIdleEdge = runtimeService.subscribeAgentIdleEdge((event) =>
    service.handleIdleEdge(event)
  )
  state.scheduledMessageService = service
  service.start()
  return service
}
