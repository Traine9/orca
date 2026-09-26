import { sha256 } from '@noble/hashes/sha256'

// Sealed by src/main/runtime/push/push-e2e-seal.ts for token 'f' x 48 (see
// push-e2e-seal.test.ts), so these suites prove the phone opens what the desktop sends.
const publicKeyB64 = Buffer.alloc(32, 7).toString('base64')
const hostFingerprint = Buffer.from(sha256(Buffer.alloc(32, 7)))
  .toString('base64url')
  .slice(0, 16)

export const SEALED_VECTOR = {
  deviceToken: 'f'.repeat(48),
  paneKey:
    'e2e1:cr6LTFCtGKqKJdLLuENN+xz5Xk8lA6aZkiXO3wPUV4lfT/NXHp+TRv8KifNd18mJrpkDocDmPsnuoZ7dasQGbdaxRuvzudJYyiTFA5firWLw9J7UQAEmx2AO3odADvbinGIJsVj8kK74bqHbFQNh1Itb2vGOF+aLemiHOztYauI=',
  /** The FCM data map the gateway builds from the sealed notification. */
  fcmData: {
    hostFingerprint,
    notificationId: 'e2e1.w_xMUGqEqPK_qKRKa75x6ZqDxLJ5mEqA',
    notificationSeq: '1',
    notificationEpoch: 'e',
    source: 'agent-task-complete',
    agentState: 'finished',
    title: 'Agent finished',
    message: '',
    channelId: 'orca-desktop',
    paneKey:
      'e2e1:cr6LTFCtGKqKJdLLuENN+xz5Xk8lA6aZkiXO3wPUV4lfT/NXHp+TRv8KifNd18mJrpkDocDmPsnuoZ7dasQGbdaxRuvzudJYyiTFA5firWLw9J7UQAEmx2AO3odADvbinGIJsVj8kK74bqHbFQNh1Itb2vGOF+aLemiHOztYauI='
  }
} as const

export function sealedVectorHost(deviceToken: string = SEALED_VECTOR.deviceToken): {
  id: string
  publicKeyB64: string
  deviceToken: string
} {
  return { id: 'host-1', publicKeyB64, deviceToken }
}
