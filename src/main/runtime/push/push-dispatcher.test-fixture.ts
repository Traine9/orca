import { vi } from 'vitest'
import type { MobilePushRegistration } from '../../../shared/mobile-push-contract'
import type { MobileNotificationEvent } from './notifications/runtime-mobile-notification-controller'
import type { PushGatewayClient, PushSendResult } from './push-gateway-client'
import { PushDispatcher, type PushDispatcherRegistry } from './push-dispatcher'
import { openSealedPushNotification } from './push-e2e-seal.test-fixture'

export function registration(
  overrides: Partial<MobilePushRegistration> = {}
): MobilePushRegistration {
  return {
    registrationId: 'reg-1',
    filter: {},
    expiresAt: Date.now() + 7 * 86400_000,
    ...overrides
  }
}

export type SendCall = Parameters<PushGatewayClient['send']>[0]

export function createHarness(options: {
  devices: { deviceId: string; token?: string; pushRegistration?: MobilePushRegistration }[]
  results?: PushSendResult[]
  sendImpl?: () => Promise<never>
}): {
  dispatcher: PushDispatcher
  /** What each phone reads once it opens its sealed payload. */
  sends: SendCall[]
  /** What the gateway actually received. */
  wireSends: SendCall[]
  cleared: (string | null)[]
  runRetry: () => void
} {
  const sends: SendCall[] = []
  const wireSends: SendCall[] = []
  const cleared: (string | null)[] = []
  let retry: (() => void) | null = null
  // Mapped on every read (not copied once) so suites that swap a registration in place still work.
  const listDevices = (): ReturnType<PushDispatcherRegistry['listDevices']> =>
    options.devices.map((device) => ({ token: `token-${device.deviceId}`, ...device }))
  const tokenFor = (registrationId: string | undefined): string =>
    listDevices().find((device) => device.pushRegistration?.registrationId === registrationId)
      ?.token ?? ''
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the dispatcher only calls send on the gateway client.
  const client = {
    send: vi.fn(async (input: SendCall) => {
      wireSends.push(input)
      sends.push({
        ...input,
        notification: openSealedPushNotification(
          input.notification,
          tokenFor(input.registrationIds[0])
        )
      })
      if (options.sendImpl) {
        return await options.sendImpl()
      }
      return {
        ok: true as const,
        results:
          options.results ??
          input.registrationIds.map((registrationId) => ({
            registrationId,
            status: 'queued' as const
          }))
      }
    })
  } as unknown as PushGatewayClient
  const registry: PushDispatcherRegistry = {
    listDevices,
    setPushRegistration: (deviceId, value) => {
      cleared.push(value === null ? deviceId : null)
      return true
    }
  }
  return {
    dispatcher: new PushDispatcher({
      client,
      registry,
      scheduleRetry: (run) => {
        retry = run
      }
    }),
    sends,
    wireSends,
    cleared,
    runRetry: () => retry?.()
  }
}

export function notification(
  overrides: Partial<MobileNotificationEvent> = {}
): MobileNotificationEvent {
  return {
    type: 'notification',
    source: 'agent-task-complete',
    title: 'feat/x - Claude finished',
    body: 'All done.',
    worktreeId: 'repo::wt1',
    notificationId: 'agent:one',
    notificationSeq: 7,
    notificationEpoch: 'epoch-1',
    agentState: 'done',
    ...overrides
  } as MobileNotificationEvent
}

export const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))
