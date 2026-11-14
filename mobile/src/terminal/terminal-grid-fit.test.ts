import { describe, expect, it } from 'vitest'
import { fitDimensionsFromCell } from './terminal-grid-fit'

const CELL_1X = { cellWidth: 23 / 3, cellHeight: 15 }

describe('fitDimensionsFromCell', () => {
  it('answers null for a landscape phone frame too short for an agent TUI', () => {
    // A 46x35 portrait phone turned sideways: floor(780 / 7.667) = 101, floor(165 / 15) = 11.
    expect(fitDimensionsFromCell(CELL_1X, 780, 165)).toBeNull()
  })

  it('fits a frame exactly MIN_FIT_ROWS tall', () => {
    expect(fitDimensionsFromCell(CELL_1X, 427, 240)).toEqual({ cols: 55, rows: 16 })
  })

  it('keeps an exact fit at a fractional pixel ratio whole', () => {
    // An exact device-pixel fit can divide to 49.999… after pixel-ratio conversion.
    const cell = { cellWidth: 18 / 2.75, cellHeight: 40 / 2.75 }
    expect(fitDimensionsFromCell(cell, 900 / 2.75, 1320 / 2.75)).toEqual({ cols: 50, rows: 33 })
  })

  it('still falls short of a column the frame does not hold', () => {
    const cell = { cellWidth: 393 / 51, cellHeight: 15 }
    expect(fitDimensionsFromCell(cell, 1080 / 2.75, 600)?.cols).toBe(50)
  })
})
