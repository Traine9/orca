import { describe, expect, it } from 'vitest'
import { createHarness, flush, notification, registration } from './push-dispatcher.test-fixture'

describe('PushDispatcher sealed content', () => {
  it('sends each matching device its own payload', async () => {
    const harness = createHarness({
      devices: [
        { deviceId: 'a', pushRegistration: registration({ registrationId: 'reg-a' }) },
        { deviceId: 'b', pushRegistration: registration({ registrationId: 'reg-b' }) }
      ]
    })

    harness.dispatcher.enqueue(notification({ paneKey: 'tab-1:pane-1' }))
    await flush()

    expect(harness.sends.map((send) => send.registrationIds)).toEqual([['reg-a'], ['reg-b']])
    expect(harness.sends[0]?.notification).toMatchObject({
      source: 'agent-task-complete',
      notificationSeq: 7,
      notificationEpoch: 'epoch-1',
      notificationId: 'agent:one',
      worktreeId: 'repo::wt1',
      paneKey: 'tab-1:pane-1',
      title: 'feat/x - Claude finished',
      body: 'All done.'
    })
  })

  it('never hands the gateway the text, worktree, pane or real notification id', async () => {
    const harness = createHarness({
      devices: [
        { deviceId: 'a', pushRegistration: registration({ registrationId: 'reg-a' }) },
        { deviceId: 'b', pushRegistration: registration({ registrationId: 'reg-b' }) }
      ]
    })

    harness.dispatcher.enqueue(notification({ paneKey: 'tab-1:pane-1' }))
    harness.dispatcher.enqueue({
      type: 'dismiss',
      notificationId: 'agent:one',
      notificationSeq: 8,
      notificationEpoch: 'epoch-1'
    })
    await flush()

    expect(harness.wireSends).toHaveLength(4)
    for (const send of harness.wireSends) {
      const wire = JSON.stringify(send)
      expect(wire).not.toMatch(/feat\/x|All done\.|repo::wt1|agent:one|tab-1:pane-1|epoch-1/)
      expect(send.notification.worktreeId).toBeUndefined()
      expect(send.notification.paneKey).toMatch(/^e2e1:/)
    }
    expect(harness.wireSends[0]?.notification.title).not.toContain('feat/x')
    expect(harness.wireSends[0]?.notification.body).toBe('')
    // Per-device keys: the same event reaches two phones as unrelated ciphertexts and ids.
    expect(harness.wireSends[0]?.notification.notificationId).not.toBe(
      harness.wireSends[1]?.notification.notificationId
    )
    // The gateway refuses a differing copy of an event it already holds, so each phone's event differs.
    expect(harness.wireSends[0]?.notification.notificationEpoch).not.toBe(
      harness.wireSends[1]?.notification.notificationEpoch
    )
    // A dismissal must name the alert it retracts by that phone's own opaque id and epoch.
    for (const [alert, dismiss] of [
      [harness.wireSends[0], harness.wireSends[2]],
      [harness.wireSends[1], harness.wireSends[3]]
    ]) {
      expect(dismiss?.registrationIds).toEqual(alert?.registrationIds)
      expect(dismiss?.notification).toMatchObject({
        kind: 'dismiss',
        notificationId: alert?.notification.notificationId,
        notificationEpoch: alert?.notification.notificationEpoch
      })
    }
    // Each phone opens the real epoch back out of its own envelope.
    expect(harness.sends.map((send) => send.notification.notificationEpoch)).toEqual([
      'epoch-1',
      'epoch-1',
      'epoch-1',
      'epoch-1'
    ])
  })

  it('skips a device without a pairing token instead of sending in the clear', async () => {
    const harness = createHarness({
      devices: [{ deviceId: 'a', token: '', pushRegistration: registration() }]
    })

    harness.dispatcher.enqueue(notification())
    await flush()

    expect(harness.wireSends).toHaveLength(0)
  })

  it('drops a dead registration among many devices', async () => {
    const devices = Array.from({ length: 25 }, (_, index) => ({
      deviceId: `device-${index}`,
      pushRegistration: registration({ registrationId: `reg-${index}` })
    }))
    const harness = createHarness({
      devices,
      results: [{ registrationId: 'reg-24', status: 'dead' }]
    })

    harness.dispatcher.enqueue(notification())
    await flush()

    expect(harness.sends).toHaveLength(25)
    expect(harness.cleared).toEqual(['device-24'])
  })
})
