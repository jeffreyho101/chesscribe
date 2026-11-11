import { Chess } from 'chess.js'

export const START_FEN = new Chess().fen()

export interface MoveResult {
  input: string
  san: string | null
  legal: boolean
  empty: boolean
  fenAfter: string
  acceptedAfter: number
  acceptedIndex: number | null
}

export interface Analysis {
  results: MoveResult[]
  fens: string[]
  accepted: string[]
}

export interface GameDetails {
  white: string
  black: string
  whiteElo: string
  blackElo: string
  result: string
}

export const DEFAULT_DETAILS: GameDetails = {
  white: '',
  black: '',
  whiteElo: '',
  blackElo: '',
  result: '*',
}

export const RESULTS = ['*', '1-0', '0-1', '1/2-1/2'] as const

export function normalizeSan(raw: string): string {
  let san = raw.trim().replace(/\s+/g, '')
  if (!san) return ''
  san = san.replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O')
  san = san.replace(/o-o-o/gi, 'O-O-O').replace(/o-o/gi, 'O-O')
  san = san.replace(/([KQRBNa-h]):/g, '$1x')
  return san
}

export function analyzeMoves(moves: readonly string[]): Analysis {
  const chess = new Chess()
  const fens = [chess.fen()]
  const accepted: string[] = []
  const results: MoveResult[] = []

  for (const raw of moves) {
    const san = normalizeSan(raw)

    if (!san) {
      results.push({
        input: raw,
        san: null,
        legal: true,
        empty: true,
        fenAfter: chess.fen(),
        acceptedAfter: accepted.length,
        acceptedIndex: null,
      })
      continue
    }

    try {
      const move = chess.move(san)
      accepted.push(move.san)
      fens.push(chess.fen())
      results.push({
        input: raw,
        san: move.san,
        legal: true,
        empty: false,
        fenAfter: chess.fen(),
        acceptedAfter: accepted.length,
        acceptedIndex: accepted.length - 1,
      })
    } catch {
      results.push({
        input: raw,
        san,
        legal: false,
        empty: false,
        fenAfter: chess.fen(),
        acceptedAfter: accepted.length,
        acceptedIndex: null,
      })
    }
  }

  return { results, fens, accepted }
}

function tagValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function buildPgn(analysis: Analysis, details: GameDetails): string {
  const chess = new Chess()

  const white = details.white.trim() || '?'
  const black = details.black.trim() || '?'
  const whiteElo = details.whiteElo.trim()
  const blackElo = details.blackElo.trim()
  const result = RESULTS.includes(details.result as (typeof RESULTS)[number])
    ? details.result
    : '*'

  chess.setHeader('White', tagValue(white))
  chess.setHeader('Black', tagValue(black))
  chess.setHeader('Result', result)
  if (whiteElo) chess.setHeader('WhiteElo', tagValue(whiteElo))
  if (blackElo) chess.setHeader('BlackElo', tagValue(blackElo))

  for (const san of analysis.accepted) chess.move(san)

  return chess.pgn()
}

export function pgnMovetext(pgn: string): string {
  const split = pgn.indexOf('\n\n')
  return (split === -1 ? pgn : pgn.slice(split + 2)).trim()
}

export function lichessUrl(analysis: Analysis, details: GameDetails): string {
  const pgn = buildPgn(analysis, details)
  return `https://lichess.org/analysis/pgn/${encodeURIComponent(pgnMovetext(pgn))}`
}
