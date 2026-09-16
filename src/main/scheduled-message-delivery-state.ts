/** One delivery run's bookkeeping: how many times we have tried, and how long
 *  we deliberately held the message back because its pane was sitting on a
 *  provider usage limit. `deferringSince` is non-null exactly while the last
 *  pass deferred, so an open wait counts up to *now* rather than to the previous
 *  tick — otherwise every deferring message loses a tick of its grace. */
type DeliveryRun = {
  attempts: number
  deferredMs: number
  deferringSince: number | null
}

/**
 * Per-message delivery bookkeeping, in memory on purpose — a restart is a fresh
 * chance, and persisting either number would strand a message against conditions
 * that no longer exist.
 */
export class ScheduledMessageDeliveryState {
  private readonly runs = new Map<string, DeliveryRun>()

  attemptsFor(messageId: string): number {
    return this.runs.get(messageId)?.attempts ?? 0
  }

  recordAttempt(messageId: string): void {
    this.run(messageId).attempts += 1
  }

  /** Opens the wait, or leaves an already-open one running. */
  beginDeferral(messageId: string, now: number): void {
    const run = this.run(messageId)
    run.deferringSince ??= now
  }

  /** Closes the wait and banks it. Called on every pass that did NOT defer, so a
   *  pane that frees up stops accruing credit. */
  endDeferral(messageId: string, now: number): void {
    const run = this.runs.get(messageId)
    if (!run || run.deferringSince === null) {
      return
    }
    run.deferredMs += now - run.deferringSince
    run.deferringSince = null
  }

  /**
   * Time to forgive when deciding whether a message is too late to send.
   *
   * The missed-grace window means "Orca was closed so long that the agent's
   * context has moved on". Waiting out a usage limit is the opposite of that —
   * it is the feature working — so that time must not be charged against it, or
   * every message scheduled to land when a limit expires is marked `missed` ten
   * minutes in. The credit survives the limit clearing, so a delivery that fails
   * right after a long wait still gets its full grace window.
   */
  deferredMs(messageId: string, now: number): number {
    const run = this.runs.get(messageId)
    if (!run) {
      return 0
    }
    return run.deferredMs + (run.deferringSince === null ? 0 : now - run.deferringSince)
  }

  /** A revived row gets a full set of attempts, but keeps the wait it has already
   *  served: the limit it is waiting on does not reset because the user pressed
   *  "Send now". */
  forgetAttempts(messageId: string): void {
    const run = this.runs.get(messageId)
    if (run) {
      run.attempts = 0
    }
  }

  /** Rescheduling moves the due moment, which is what the credit was measured
   *  against — so it starts over. */
  forgetDeferrals(messageId: string): void {
    const run = this.runs.get(messageId)
    if (run) {
      run.deferredMs = 0
      run.deferringSince = null
    }
  }

  /** The whole run is over: the row was removed, settled, or given up on. */
  forget(messageId: string): void {
    this.runs.delete(messageId)
  }

  private run(messageId: string): DeliveryRun {
    const existing = this.runs.get(messageId)
    if (existing) {
      return existing
    }
    const created: DeliveryRun = { attempts: 0, deferredMs: 0, deferringSince: null }
    this.runs.set(messageId, created)
    return created
  }
}
