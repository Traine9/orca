// Why: the push gateway and Google FCM relay every field of a notification in the
// clear, and the rich body is the agent's last message or tool input (commands,
// paths, sometimes secrets). Each notification is sealed per device with a key
// only the desktop and that phone hold: the pairing device token, which never
// reaches the gateway. The gateway still sees a generic title, the agent state and
// the sequence fields it needs for delivery and dismissal.
//
// Wire format (mirrored in mobile/src/notifications/push-sealed-payload.ts):
//   key       = HMAC-SHA256(key = deviceToken, "orca-push-e2e-v1")
//   paneKey   = "e2e1:" + base64(nonce[24] || secretbox(JSON envelope, nonce, key))
//   envelope  = { t?: title, b?: body, w?: worktreeId, p?: paneKey, n?: notificationId }
//   notificationId on the wire = "e2e1." + base64url(HMAC-SHA256(key, "id:" + id))[0..32]
// paneKey is the carrier because the gateway passes it through verbatim with a
// 2048-char budget; the real paneKey, which routes a tap to the agent, rides inside.
import { createHmac } from 'node:crypto'
import nacl from 'tweetnacl'
import type { PushSendNotification } from './push-gateway-client'

export const SEALED_PUSH_PREFIX = 'e2e1:'
const OPAQUE_ID_PREFIX = 'e2e1.'
const KEY_LABEL = 'orca-push-e2e-v1'
// The gateway's paneKey limit.
const MAX_SEALED_LENGTH = 2048

type SealedEnvelope = { t?: string; b?: string; w?: string; p?: string; n?: string }

export function derivePushSealKey(deviceToken: string): Uint8Array {
  return new Uint8Array(createHmac('sha256', deviceToken).update(KEY_LABEL).digest())
}

export function opaquePushNotificationId(key: Uint8Array, notificationId: string): string {
  const digest = createHmac('sha256', key).update(`id:${notificationId}`).digest('base64url')
  return `${OPAQUE_ID_PREFIX}${digest.slice(0, 32)}`
}

function sealEnvelope(envelope: SealedEnvelope, key: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const box = nacl.secretbox(new TextEncoder().encode(JSON.stringify(envelope)), nonce, key)
  return SEALED_PUSH_PREFIX + Buffer.concat([nonce, box]).toString('base64')
}

function placeholderTitle(notification: PushSendNotification): string {
  if (notification.agentState === 'needs-input') {
    return 'Agent needs input'
  }
  if (notification.agentState === 'finished') {
    return 'Agent finished'
  }
  return 'Orca'
}

export function sealPushNotification(
  notification: PushSendNotification,
  deviceToken: string
): PushSendNotification {
  const key = derivePushSealKey(deviceToken)
  const { worktreeId, paneKey, notificationId, title, body, ...rest } = notification
  const isDismiss = notification.kind === 'dismiss'
  const envelope: SealedEnvelope = {
    ...(isDismiss ? {} : { t: title, b: body }),
    ...(worktreeId ? { w: worktreeId } : {}),
    ...(paneKey ? { p: paneKey } : {}),
    ...(notificationId ? { n: notificationId } : {})
  }
  let sealed = sealEnvelope(envelope, key)
  // Budget order: the real id only improves dismissal matching, so it goes first;
  // the body is shortened last because it is what the user reads.
  if (sealed.length > MAX_SEALED_LENGTH) {
    delete envelope.n
    sealed = sealEnvelope(envelope, key)
  }
  while (sealed.length > MAX_SEALED_LENGTH && envelope.b) {
    envelope.b = `${envelope.b.slice(0, Math.floor(envelope.b.length * 0.75))}…`
    sealed = sealEnvelope(envelope, key)
  }
  if (sealed.length > MAX_SEALED_LENGTH) {
    delete envelope.w
    delete envelope.p
    sealed = sealEnvelope(envelope, key)
  }
  return {
    ...rest,
    ...(notificationId ? { notificationId: opaquePushNotificationId(key, notificationId) } : {}),
    title: isDismiss ? title : placeholderTitle(notification),
    body: '',
    paneKey: sealed
  }
}
