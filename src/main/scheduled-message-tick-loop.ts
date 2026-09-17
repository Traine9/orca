/** The coarse scan that drives `at` timings.
 *
 *  A chained timer rather than `setInterval`: a delivery pass can outlive one
 *  interval (the send guard alone waits up to ~1s per message), and re-arming
 *  only after the previous pass finishes makes overlapping scans impossible by
 *  construction instead of by a re-entrancy flag.
 *
 *  Its own module because the property that matters here — the loop survives a
 *  failing pass — is one a test should be able to state directly, without a
 *  store, a pane resolver and a clock standing in the way. */
export class ScheduledMessageTickLoop {
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  constructor(
    private readonly pass: () => Promise<void>,
    private readonly intervalMs: number,
    private readonly logger: Pick<Console, 'warn'>
  ) {}

  /** Runs one immediate pass before arming the timer, so messages that came due
   *  while Orca was closed are resolved at launch rather than a full tick later. */
  start(): void {
    void this.run()
  }

  dispose(): void {
    this.stopped = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private async run(): Promise<void> {
    try {
      await this.pass()
    } catch (error) {
      // This loop is the only thing that ever revisits a due message, so one
      // unexpected throw — a destroyed window on a snapshot send, a store read
      // racing teardown — must not end scheduling for the rest of the session.
      this.logger.warn('[scheduled-messages] tick failed', { error })
    }
    if (this.stopped) {
      return
    }
    this.timer = setTimeout(() => {
      void this.run()
    }, this.intervalMs)
    // Never hold the process open for a scan that has nothing to deliver.
    if (typeof this.timer.unref === 'function') {
      this.timer.unref()
    }
  }
}
