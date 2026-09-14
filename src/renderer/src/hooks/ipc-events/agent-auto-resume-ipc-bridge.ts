import { useAppStore } from '../../store'

export function registerAgentAutoResumeIpcBridge(unsubs: (() => void)[]): void {
  const unsubscribeAutoResume = window.api.agentAutoResume?.onUpdate?.((snapshot) => {
    useAppStore.getState().setAutoResumeSnapshot?.(snapshot)
  })
  if (unsubscribeAutoResume) {
    unsubs.push(unsubscribeAutoResume)
  }
  // Why: the service only pushes on state changes, so hydrate current state
  // once on mount in case a stall was detected before this subscription.
  // Wrapped in Promise.resolve because harnesses that stub window.api return
  // a non-thenable from get(); the optional call covers harnesses that stub
  // the store with a partial state. Neither may reject this hook's mount.
  void Promise.resolve(window.api.agentAutoResume?.get?.()).then((snapshot) => {
    if (snapshot) {
      useAppStore.getState().setAutoResumeSnapshot?.(snapshot)
    }
  })

  // No subscription: the renderer is the only writer of the armed set, so the
  // one-shot hydrate is enough to survive a reload.
  void Promise.resolve(window.api.rateLimitWatcher?.get?.()).then((snapshot) => {
    if (snapshot) {
      useAppStore.getState().setRateLimitWatcherSnapshot?.(snapshot)
    }
  })
}
