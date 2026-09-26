import { describe, expect, it } from 'vitest'
import type { PushSendNotification } from './push-gateway-client'
import { opaquePushNotificationId, derivePushSealKey, sealPushNotification } from './push-e2e-seal'
import { openSealedPushNotification } from './push-e2e-seal.test-fixture'

const TOKEN = 'a'.repeat(48)

function alert(overrides: Partial<PushSendNotification> = {}): PushSendNotification {
  return {
    notificationSeq: 3,
    notificationEpoch: 'epoch',
    notificationId: 'agent:repo%3A%3A%2Fhome%2Fme%2Fsecret-project:pane:1',
    source: 'agent-task-complete',
    agentState: 'needs-input',
    title: 'secret-project - Claude needs input',
    body: 'Using Bash: curl -H "Authorization: Bearer sk-live-123"',
    worktreeId: 'repo::/home/me/secret-project',
    ...overrides
  }
}

describe('sealPushNotification', () => {
  it('round-trips through the phone side and leaves only generic text on the wire', () => {
    const wire = sealPushNotification(alert(), TOKEN)

    expect(wire).toMatchObject({ title: 'Agent needs input', body: '' })
    expect(wire.worktreeId).toBeUndefined()
    expect(JSON.stringify(wire)).not.toMatch(/secret-project|sk-live|Bearer/)
    expect(openSealedPushNotification(wire, TOKEN)).toMatchObject({
      title: 'secret-project - Claude needs input',
      body: 'Using Bash: curl -H "Authorization: Bearer sk-live-123"',
      worktreeId: 'repo::/home/me/secret-project',
      notificationId: alert().notificationId
    })
  })

  it('carries the tap-routing pane key inside the envelope', () => {
    const wire = sealPushNotification(alert({ paneKey: 'tab-secret:pane-1' }), TOKEN)
    expect(wire.paneKey).toMatch(/^e2e1:/)
    expect(JSON.stringify(wire)).not.toContain('tab-secret')
    expect(openSealedPushNotification(wire, TOKEN).paneKey).toBe('tab-secret:pane-1')
  })

  it('refuses to open with another device token', () => {
    const wire = sealPushNotification(alert(), TOKEN)
    expect(() => openSealedPushNotification(wire, 'b'.repeat(48))).toThrow()
  })

  it('uses a fresh nonce per send but a stable opaque id for dismissal matching', () => {
    const first = sealPushNotification(alert(), TOKEN)
    const second = sealPushNotification(alert({ kind: 'dismiss' }), TOKEN)
    expect(first.paneKey).not.toBe(second.paneKey)
    expect(second.notificationId).toBe(first.notificationId)
    expect(first.notificationId).toBe(
      opaquePushNotificationId(derivePushSealKey(TOKEN), alert().notificationId!)
    )
    expect(first.notificationId).toMatch(/^[\x20-\x7e]{1,2048}$/)
  })

  it('stays inside the gateway budgets with maximal multibyte text', () => {
    const wire = sealPushNotification(
      alert({
        title: 'Ж'.repeat(80),
        body: '🙂'.repeat(90),
        worktreeId: `repo::${'п'.repeat(600)}`,
        notificationId: `agent:${'%D0%BF'.repeat(300)}`
      }),
      TOKEN
    )
    expect(wire.paneKey!.length).toBeLessThanOrEqual(2048)
    expect(new TextEncoder().encode(JSON.stringify(wire)).byteLength).toBeLessThanOrEqual(3000)
    expect(openSealedPushNotification(wire, TOKEN).title).toBe('Ж'.repeat(80))
  })
})
