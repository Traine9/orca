/** Terminals the user armed the rate-limit watcher on, by tab id.
 *
 *  Scoped to a terminal rather than a workspace because that is the unit the
 *  watcher actually acts on: one tab runs one agent, and a workspace commonly
 *  has several — arming all of them to reach one is the wrong bargain for a
 *  feature that presses keys unattended.
 *
 *  Tab ids rather than pty ids: a PTY is replaced across restarts and respawns,
 *  and the box is ticked long before the stall it is meant to catch. */
export type RateLimitWatcherSnapshot = {
  tabIds: string[]
}

/** Bound on the armed-tab list. Closed tab ids are never reused, so without a
 *  ceiling the set would only ever grow. */
export const MAX_RATE_LIMIT_WATCHER_TABS = 200
