import React, { useCallback, useMemo, useState } from 'react'
import { Clock, MoreHorizontal, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { useWorktreeMap } from '@/store/selectors'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type {
  ScheduledMessage,
  ScheduledMessageTiming
} from '../../../../shared/scheduled-message-types'
import { ScheduledMessageComposeDialog } from './ScheduledMessageComposeDialog'
import {
  formatScheduledMessageStatus,
  formatScheduledMessageWhen,
  previewScheduledMessageText
} from './scheduled-message-format'

type ScheduledMessagesSectionProps = {
  /** Ticking clock supplied by the host page so every row's countdown and the
   *  automation rows below it advance on the same beat. */
  relativeNow: number
}

/**
 * The management surface for scheduled messages: Telegram's clock-icon pending
 * list, widened to every workspace at once.
 *
 * Deliberately its own section rather than another kind inside the automations
 * list. They share this page because both are "things Orca does later", but an
 * automation is recurring, headless, and carries run history, while these are
 * one-shot messages typed into a session you are already in — and the list's
 * enabled/paused and last-run filters are meaningless for them.
 */
export function ScheduledMessagesSection({
  relativeNow
}: ScheduledMessagesSectionProps): React.JSX.Element | null {
  const messages = useAppStore((s) => s.scheduledMessages)
  const worktreeMap = useWorktreeMap()
  const [editing, setEditing] = useState<ScheduledMessage | null>(null)

  const sorted = useMemo(() => {
    // Problems first — they are the rows demanding a decision — then by due time.
    return [...(messages ?? [])].sort((a, b) => {
      if ((a.status === 'pending') !== (b.status === 'pending')) {
        return a.status === 'pending' ? 1 : -1
      }
      const aAt = a.timing.kind === 'at' ? a.timing.sendAt : Number.POSITIVE_INFINITY
      const bAt = b.timing.kind === 'at' ? b.timing.sendAt : Number.POSITIVE_INFINITY
      return aAt - bAt
    })
  }, [messages])

  const handleSendNow = useCallback((messageId: string) => {
    void window.api.scheduledMessages?.sendNow(messageId)
  }, [])

  const handleDelete = useCallback((messageId: string) => {
    void window.api.scheduledMessages?.delete(messageId)
  }, [])

  const handleSubmitEdit = useCallback(
    async (draft: { text: string; timing: ScheduledMessageTiming }) => {
      if (editing) {
        await window.api.scheduledMessages?.update(editing.id, draft)
      }
    },
    [editing]
  )

  if (sorted.length === 0) {
    return null
  }

  return (
    <section className="shrink-0 px-3 pb-4 md:px-5">
      <div className="mb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-3.5" />
          {translate('auto.components.scheduledMessages.sectionTitle', 'Scheduled messages')}
        </h2>
        <p className="text-xs text-muted-foreground text-pretty">
          {translate(
            'auto.components.scheduledMessages.sectionSubtitle',
            'One-time messages Orca will type into a workspace’s agent. Schedule them from a workspace’s right-click menu.'
          )}
        </p>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {sorted.map((message) => {
          const statusLabel = formatScheduledMessageStatus(message)
          const worktree = worktreeMap.get(message.worktreeId)
          return (
            <li key={message.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <button
                type="button"
                className="w-40 shrink-0 truncate text-left text-xs font-medium hover:underline"
                onClick={() => void activateAndRevealWorktree(message.worktreeId)}
              >
                {worktree?.displayName ??
                  translate(
                    'auto.components.scheduledMessages.unknownWorkspace',
                    'Unknown workspace'
                  )}
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {previewScheduledMessageText(message.text)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[420px] whitespace-pre-wrap">
                  {message.text}
                </TooltipContent>
              </Tooltip>
              <span
                className={cn(
                  'w-52 shrink-0 truncate text-right text-xs',
                  statusLabel ? 'text-annotation-highlight' : 'text-muted-foreground'
                )}
              >
                {statusLabel ?? formatScheduledMessageWhen(message.timing, relativeNow)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={translate('auto.components.scheduledMessages.sendNow', 'Send now')}
                onClick={() => handleSendNow(message.id)}
              >
                <Send className="size-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={translate(
                      'auto.components.scheduledMessages.rowActions',
                      'Scheduled message actions'
                    )}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(message)}>
                    {translate('auto.components.scheduledMessages.edit', 'Edit…')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleSendNow(message.id)}>
                    {translate('auto.components.scheduledMessages.sendNow', 'Send now')}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(message.id)}>
                    {translate('auto.components.scheduledMessages.delete', 'Delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
      </ul>
      <ScheduledMessageComposeDialog
        open={editing !== null}
        {...(editing ? { message: editing } : {})}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
          }
        }}
        onSubmit={handleSubmitEdit}
      />
    </section>
  )
}
