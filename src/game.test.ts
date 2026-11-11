import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DETAILS,
  START_FEN,
  analyzeMoves,
  buildPgn,
  lichessUrl,
  moveIndexAtPly,
  moveIndexForNextPly,
  moveSanFromFen,
  normalizeSan,
  pgnMovetext,
  setMoveAtPly,
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

  it('marks ambiguous moves as illegal', () => {
    const prefix = ['d4', 'a6', 'Nf3', 'a5']
    const ambiguous = analyzeMoves([...prefix, 'Nd2'])
    const explicit = analyzeMoves([...prefix, 'Nbd2'])

    expect(ambiguous.results[4].legal).toBe(false)
    expect(explicit.results[4].legal).toBe(true)
    expect(explicit.results[4].san).toBe('Nbd2')
  })
})

describe('board editing helpers', () => {
  it('maps a ply to the move that produced it', () => {
    const analysis = analyzeMoves(['e4', 'e5', 'Nf3'])

    expect(moveIndexAtPly(analysis, 0)).toBeNull()
    expect(moveIndexAtPly(analysis, 1)).toBe(0)
    expect(moveIndexAtPly(analysis, 3)).toBe(2)
  })

  it('replaces the next move without dropping later moves', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6']
    const analysis = analyzeMoves(moves)

    expect(setMoveAtPly(moves, analysis, 1, 'c5')).toEqual([
      'e4',
      'c5',
      'Nf3',
      'Nc6',
    ])
  })

  it('appends a move at the end of the game', () => {
    const moves = ['e4']
    const analysis = analyzeMoves(moves)

    expect(setMoveAtPly(moves, analysis, 1, 'e5')).toEqual(['e4', 'e5'])
  })

  it('builds SAN from a legal board move', () => {
    expect(moveSanFromFen(START_FEN, 'e2', 'e4')).toBe('e4')
    expect(moveSanFromFen(START_FEN, 'e2', 'e5')).toBeNull()
  })

  it('overwrites an ambiguous move instead of the next populated cell', () => {
    const moves = [
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'c3',
      'd5',
      'Qa4',
      'dxe4',
      'Nxe5',
      'Bd7',
      'Nxd7',
      'Qxd7',
      'Qxe4+',
      'Be7',
      'Bb5',
      'Nf6',
      'Bxc6',
      'bxc6',
      'Qf3',
      'O-O',
      'd4',
      'Re8',
      'Bd2',
    ]
    const analysis = analyzeMoves(moves)

    expect(analysis.results[21].legal).toBe(false)
    expect(moveIndexForNextPly(analysis, 21)).toBe(21)
    expect(setMoveAtPly(moves, analysis, 21, 'Rfe8')).toEqual([
      ...moves.slice(0, 21),
      'Rfe8',
      'Bd2',
    ])
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
