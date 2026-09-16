import { Notification } from 'electron'
import type { NotificationSettings } from '../shared/notification-settings-types'
import { retainNotificationUntilRelease } from './ipc/native-notification-lifecycle'
import { getEffectiveNotificationSoundId } from './ipc/notification-sound-selection'
import type { ScheduledMessageNotification } from './scheduled-message-service'

export type ScheduledMessageNotifierDeps = {
  getNotificationSettings: () => NotificationSettings
  /** Bring Orca forward and focus the affected workspace on click. */
  focus?: (worktreeId: string) => void
  logger?: Pick<Console, 'warn'>
}

function buildContent(notification: ScheduledMessageNotification): {
  title: string
  body: string
} {
  if (notification.kind === 'sent') {
    return {
      title: 'Scheduled message sent',
      body: 'Orca delivered your queued message to the agent.'
    }
  }
  if (notification.kind === 'missed') {
    return {
      title: 'Scheduled message missed',
      body: 'Orca was closed when it came due. It is waiting in Automations — send or reschedule it.'
    }
  }
  if (notification.failureReason === 'no-pane') {
    return {
      title: "Scheduled message couldn't be delivered",
      body: 'That workspace had no open terminal. Open it, then use Send now in Automations.'
    }
  }
  if (notification.failureReason === 'no-agent') {
    return {
      title: "Scheduled message couldn't be delivered",
      body: 'No agent was running in that workspace, so Orca refused to type into a plain shell.'
    }
  }
  return {
    title: 'Scheduled message failed',
    body: "Orca couldn't send your queued message. It is still in Automations."
  }
}

/**
 * Deliver a native notification for a scheduled-message outcome, gated by the
 * global notifications switch.
 *
 * Unlike auto-resume, success IS notified: the user wrote this text minutes or
 * hours ago and has no other signal that it landed, whereas a resumed agent
 * announces itself by simply carrying on.
 */
export function deliverScheduledMessageNotification(
  notification: ScheduledMessageNotification,
  deps: ScheduledMessageNotifierDeps
): void {
  const settings = deps.getNotificationSettings()
  if (settings.enabled !== true) {
    return
  }
  if (!Notification.isSupported()) {
    return
  }
  const { title, body } = buildContent(notification)
  try {
    // Honour the user's notification-sound choice the same way the central
    // dispatch path does: anything but 'system' means Orca plays its own sound,
    // so the OS one would double up.
    const native = new Notification({
      title,
      body,
      silent: getEffectiveNotificationSoundId(settings) !== 'system'
    })
    // Without a strong reference, GC can collect the notification — and its click
    // handler — while it is still on screen.
    const release = retainNotificationUntilRelease(native)
    if (deps.focus) {
      const worktreeId = notification.worktreeId
      native.on('click', () => {
        release()
        deps.focus?.(worktreeId)
      })
    }
    native.on('failed', (_event, error) => {
      deps.logger?.warn('[scheduled-messages] notification delivery failed', error)
      release()
    })
    native.show()
  } catch (error) {
    deps.logger?.warn('[scheduled-messages] notification failed', error)
  }
}
