import { Alert } from 'react-native'
import { router } from 'expo-router'
import { readMirroredStorage } from '../storage/mirrored-storage-keys'
import {
  LAST_VISITED_WORKTREE_STORAGE_KEY,
  readLastVisitedWorktreeRecord
} from '../worktree/last-visited-worktree-repo'
import { isMergeRequestUrl } from './url'

export const CC_TABDIFF_ROUTE = '/cc-tabdiff'

/** What the viewer screen opens: one tab's diff, an MR/PR through `/open`, or every tab. */
export type CcTabdiffTarget = { tab: string } | { mr: string } | Record<string, never>

/** Host of the open session: the session route writes it (synchronously mirrored) on mount. */
export function currentSessionHostId(): string | undefined {
  const key = LAST_VISITED_WORKTREE_STORAGE_KEY
  return readLastVisitedWorktreeRecord(readMirroredStorage([key])[key] ?? null)?.hostId
}

/** Without a host id the screen falls back to the most recently connected host. */
export function openCcTabdiff(hostId: string | undefined, target: CcTabdiffTarget = {}): void {
  const host = hostId ?? currentSessionHostId()
  router.push({
    pathname: CC_TABDIFF_ROUTE,
    params: { ...(host ? { hostId: host } : {}), ...target }
  })
}

/** Terminal link taps: an MR/PR link asks where to open; anything else goes straight to `open`. */
export function withCcTabdiffMrChooser(url: string, open: () => void): void {
  if (!isMergeRequestUrl(url)) {
    open()
    return
  }
  Alert.alert(
    'Merge request link',
    url,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open link', onPress: open },
      { text: 'Diff viewer', onPress: () => openCcTabdiff(undefined, { mr: url }) }
    ],
    { cancelable: true }
  )
}
