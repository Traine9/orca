import { useAppStore } from '../../store'

export function registerAgentAutoResumeIpcBridge(unsubs: (() => void)[]): void {
  const unsubscribeAutoResume = window.api.agentAutoResume?.onUpdate?.((snapshot) => {
    useAppStore.getState().setAutoResumeSnapshot?.(snapshot)
  })
  if (unsubscribeAutoResume) {
    unsubs.push(unsubscribeAutoResume)
  }
  // Both hydrates below describe the past by the time they resolve: an IPC
  // round-trip can finish after a pushed update or a watcher toggle has already
  // written newer state, and both setters replace their whole array. So each
  // captures its slice's revision first and lands only if nothing bumped it —
  // and `active` drops a result that arrives after this bridge was torn down.
  let active = true
  unsubs.push(() => {
    active = false
  })

  // Why: the service only pushes on state changes, so hydrate current state
  // once on mount in case a stall was detected before this subscription.
  // Wrapped in Promise.resolve because harnesses that stub window.api return
  // a non-thenable from get(); the optional call covers harnesses that stub
  // the store with a partial state. Neither may reject this hook's mount.
  const autoResumeRevision = useAppStore.getState().autoResumeRevision ?? 0
  void Promise.resolve(window.api.agentAutoResume?.get?.()).then((snapshot) => {
    if (snapshot && active) {
      useAppStore.getState().hydrateAutoResumeSnapshot?.(snapshot, autoResumeRevision)
    }
  })

  // No subscription: the renderer is the only writer of the armed set, so the
  // one-shot hydrate is enough to survive a reload.
  const watcherRevision = useAppStore.getState().rateLimitWatcherRevision ?? 0
  void Promise.resolve(window.api.rateLimitWatcher?.get?.()).then((snapshot) => {
    if (snapshot && active) {
      useAppStore.getState().hydrateRateLimitWatcherSnapshot?.(snapshot, watcherRevision)
    }
  })
}
