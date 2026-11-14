import { expect, it, vi } from 'vitest'
import * as Notifications from 'expo-notifications'
import { loadHostCatalog } from '../../host-catalog/host-store'
import { requestNotificationCatchup } from './push-dismissal-reconciliation'
import {
  SEALED_VECTOR,
  sealedVectorHost
} from '../payload-identity/push-sealed-payload.test-fixture'
vi.mock('../../host-catalog/host-store', () => ({
  loadHostCatalog: vi.fn(),
  loadHosts: vi.fn(async () => [sealedVectorHost()])
}))
vi.mock('expo-notifications', () => ({
  getPresentedNotificationsAsync: vi.fn(),
  dismissNotificationAsync: vi.fn()
}))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => {} }
}))

it('reports the real identity of a sealed alert Orca never replaced', async () => {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the reader uses only id and publicKeyB64 from catalog entries.
  vi.mocked(loadHostCatalog).mockResolvedValue([sealedVectorHost()] as never)
  vi.mocked(Notifications.getPresentedNotificationsAsync).mockResolvedValue(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the reader uses only request.identifier and content.data.
    [
      { request: { identifier: 'sealed', content: { data: { ...SEALED_VECTOR.fcmData } } } }
    ] as never
  )
  const sendRequest = vi.fn(async () => ({
    id: 'req',
    ok: true,
    result: { notifications: [], dismissedPushes: [] },
    _meta: { runtimeId: 'runtime-1' }
  }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: catch-up calls only sendRequest.
  await requestNotificationCatchup({ sendRequest } as never, 'host-1', () => false)
  expect(sendRequest).toHaveBeenCalledWith(
    'notifications.getMissedSince',
    expect.objectContaining({
      lastSeenSeq: Number.MAX_SAFE_INTEGER,
      deliveredPushes: [
        { notificationId: 'agent:wt:pane:1', notificationEpoch: 'epoch-1', notificationSeq: 1 }
      ]
    })
  )
})
