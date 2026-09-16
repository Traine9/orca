import { useCallback, useState } from 'react'
import { useAppStore } from '@/store'
import type { ScheduledMessageTiming } from '../../../../shared/scheduled-message-types'
import { selectPendingScheduledCount } from '@/store/slices/scheduled-messages'

/** The scheduled-message item of the workspace context menu and its dialog.
 *  Lives in the menu model rather than the item because the compose dialog has
 *  to outlive the dropdown that opened it. */
export function useWorkspaceScheduledMessageActions({
  menuOpen,
  worktreeId
}: {
  menuOpen: boolean
  worktreeId: string
}) {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  // Why: this count only labels an item inside the open dropdown, but scanning
  // the queue on every set() for every closed card is pure waste.
  const pendingScheduledCount = useAppStore((s) =>
    menuOpen ? selectPendingScheduledCount(s, worktreeId) : 0
  )

  const handleOpenScheduleDialog = useCallback(() => {
    setScheduleDialogOpen(true)
  }, [])

  const handleScheduleMessage = useCallback(
    async (draft: { text: string; timing: ScheduledMessageTiming }) => {
      await window.api.scheduledMessages?.add({ worktreeId, ...draft })
    },
    [worktreeId]
  )

  return {
    handleOpenScheduleDialog,
    handleScheduleMessage,
    pendingScheduledCount,
    scheduleDialogOpen,
    setScheduleDialogOpen
  }
}
