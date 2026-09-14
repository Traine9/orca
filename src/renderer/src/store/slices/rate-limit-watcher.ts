import type { StateCreator } from 'zustand'
import type { RateLimitWatcherSnapshot } from '../../../../shared/rate-limit-watcher-types'
import type { AppState } from '../types'

// Main owns the armed set; the renderer mirrors it and sends toggles straight to
// the preload API, which answers with the new set.
export type RateLimitWatcherSlice = {
  rateLimitWatcherTabIds: string[]
  setRateLimitWatcherSnapshot: (snapshot: RateLimitWatcherSnapshot) => void
  toggleRateLimitWatcher: (tabId: string, enabled: boolean) => Promise<void>
}

export const createRateLimitWatcherSlice: StateCreator<AppState, [], [], RateLimitWatcherSlice> = (
  set
) => ({
  rateLimitWatcherTabIds: [],
  setRateLimitWatcherSnapshot: (snapshot) => set({ rateLimitWatcherTabIds: snapshot.tabIds }),
  toggleRateLimitWatcher: async (tabId, enabled) => {
    const snapshot = await window.api.rateLimitWatcher?.set?.(tabId, enabled)
    if (snapshot) {
      set({ rateLimitWatcherTabIds: snapshot.tabIds })
    }
  }
})

export function selectIsRateLimitWatcherArmed(
  state: Pick<RateLimitWatcherSlice, 'rateLimitWatcherTabIds'>,
  tabId: string
): boolean {
  return (state.rateLimitWatcherTabIds ?? []).includes(tabId)
}
