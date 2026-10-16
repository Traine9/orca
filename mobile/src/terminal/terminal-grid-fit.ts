// Share frame/cell fitting between app and document so initial subscribe and later refits choose the same grid.
import { TERMINAL_VIEWPORT_MIN_COLS } from '../../../src/shared/terminal/viewport/terminal-viewport'

export type TerminalFitDimensions = { cols: number; rows: number }

// Why: a landscape phone frame holds ~10 rows. Fitting the PTY that short makes a main-buffer agent
// TUI (Claude Code's classic renderer) repaint a live area taller than the screen, and the rows that
// scroll off stay in scrollback as a stale prompt/statusline frame with the reply below it repeated.
// Below this the phone keeps the PTY's current grid instead of resizing it.
export const MIN_FIT_ROWS = 16

// Pixel-ratio division can round exact fits below an integer; a genuine one-device-pixel shortfall is much larger.
const EXACT_FIT_TOLERANCE = 1e-6

/** The grid the frame (as React Native laid it out) holds at this cell box; null when too narrow or too short. */
export function fitDimensionsFromCell(
  cell: { cellWidth: number; cellHeight: number },
  width: number,
  height: number
): TerminalFitDimensions | null {
  const cols = Math.floor(width / cell.cellWidth + EXACT_FIT_TOLERANCE)
  if (!(cols >= TERMINAL_VIEWPORT_MIN_COLS)) {
    return null
  }
  const rows = Math.floor(height / cell.cellHeight + EXACT_FIT_TOLERANCE)
  if (!(rows >= MIN_FIT_ROWS)) {
    return null
  }
  return { cols, rows }
}
