import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DETAILS,
  analyzeMoves,
  buildPgn,
  lichessUrl,
  normalizeSan,
  pgnMovetext,
  type GameDetails,
} from './game'

describe('normalizeSan', () => {
  it('normalizes zeros and colon captures', () => {
    expect(normalizeSan('0-0')).toBe('O-O')
    expect(normalizeSan('0-0-0')).toBe('O-O-O')
    expect(normalizeSan('d:e4')).toBe('dxe4')
    expect(normalizeSan('B:d3')).toBe('Bxd3')
    expect(normalizeSan('  N f 3 ')).toBe('Nf3')
  })
})

describe('analyzeMoves', () => {
  it('replays legal moves and records a fen per position', () => {
    const analysis = analyzeMoves(['e4', 'e5', 'Nf3'])

    expect(analysis.accepted).toEqual(['e4', 'e5', 'Nf3'])
    expect(analysis.fens).toHaveLength(4)
    expect(analysis.results.every((result) => result.legal)).toBe(true)
    expect(analysis.results[2].acceptedAfter).toBe(3)
  })

  it('marks illegal moves but keeps checking later moves from the same position', () => {
    const analysis = analyzeMoves(['e4', 'e4', 'e5'])

    expect(analysis.results[1].legal).toBe(false)
    expect(analysis.results[1].empty).toBe(false)
    expect(analysis.results[1].fenAfter).toBe(analysis.results[0].fenAfter)
    expect(analysis.results[2].legal).toBe(true)
    expect(analysis.fens).toHaveLength(3)
    expect(analysis.accepted).toEqual(['e4', 'e5'])
  })

  it('ignores blank cells without marking them illegal', () => {
    const analysis = analyzeMoves(['e4', '', 'e5'])

    expect(analysis.results[1].empty).toBe(true)
    expect(analysis.results[1].legal).toBe(true)
    expect(analysis.accepted).toEqual(['e4', 'e5'])
  })
})

describe('buildPgn', () => {
  const details: GameDetails = {
    white: 'Alice',
    black: 'Bob',
    whiteElo: '1500',
    blackElo: '1600',
    result: '1-0',
  }

  it('writes tags and movetext', () => {
    const analysis = analyzeMoves(['e4', 'e5', 'Nf3', 'Nc6'])
    const pgn = buildPgn(analysis, details)

    expect(pgn).toContain('[White "Alice"]')
    expect(pgn).toContain('[Black "Bob"]')
    expect(pgn).toContain('[WhiteElo "1500"]')
    expect(pgn).toContain('[BlackElo "1600"]')
    expect(pgn).toContain('[Result "1-0"]')
    expect(pgnMovetext(pgn)).toBe('1. e4 e5 2. Nf3 Nc6 1-0')
  })

  it('uses defaults and omits empty Elo tags', () => {
    const analysis = analyzeMoves(['e4'])
    const pgn = buildPgn(analysis, DEFAULT_DETAILS)

    expect(pgn).toContain('[White "?"]')
    expect(pgn).toContain('[Black "?"]')
    expect(pgn).not.toContain('WhiteElo')
    expect(pgnMovetext(pgn)).toBe('1. e4 *')
  })

  it('escapes quotes in header values', () => {
    const analysis = analyzeMoves(['e4'])
    const pgn = buildPgn(analysis, { ...DEFAULT_DETAILS, white: 'A "B"' })

    expect(pgn).toContain('[White "A \\"B\\""]')
  })
})

describe('lichessUrl', () => {
  it('encodes only the movetext', () => {
    const analysis = analyzeMoves(['e4', 'e5'])
    const url = lichessUrl(analysis, DEFAULT_DETAILS)

    expect(url).toBe(
      `https://lichess.org/analysis/pgn/${encodeURIComponent('1. e4 e5 *')}`,
    )
  })
})
