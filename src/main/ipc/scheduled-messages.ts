import { ipcMain } from 'electron'
import type { ScheduledMessageService } from '../scheduled-message-service'
import type {
  ScheduledMessage,
  ScheduledMessageChanges,
  ScheduledMessageDraft,
  ScheduledMessagesSnapshot
} from '../../shared/scheduled-message-types'

const EMPTY_SNAPSHOT: ScheduledMessagesSnapshot = { messages: [] }

const CHANNELS = [
  'scheduledMessages:get',
  'scheduledMessages:add',
  'scheduledMessages:update',
  'scheduledMessages:delete',
  'scheduledMessages:sendNow'
] as const

/** Why intents rather than a whole-array set: main owns the list, so a renderer
 *  edit can never clobber a concurrent removal by the delivery service. The
 *  renderer only ever mirrors the snapshot main pushes back. */
export function registerScheduledMessageHandlers(service?: ScheduledMessageService): void {
  for (const channel of CHANNELS) {
    ipcMain.removeHandler(channel)
  }
  ipcMain.handle(
    'scheduledMessages:get',
    (): ScheduledMessagesSnapshot => service?.getSnapshot() ?? EMPTY_SNAPSHOT
  )
  ipcMain.handle(
    'scheduledMessages:add',
    (_event, draft: ScheduledMessageDraft): ScheduledMessage | null => service?.add(draft) ?? null
  )
  ipcMain.handle(
    'scheduledMessages:update',
    (_event, messageId: string, changes: ScheduledMessageChanges): void => {
      service?.update(messageId, changes)
    }
  )
  ipcMain.handle('scheduledMessages:delete', (_event, messageId: string): void => {
    service?.remove(messageId)
  })
  ipcMain.handle('scheduledMessages:sendNow', async (_event, messageId: string): Promise<void> => {
    await service?.sendNow(messageId)
  })
}
