import { useMemo, useState } from 'react'
import {
  RESULTS,
  buildPgn,
  lichessUrl,
  type Analysis,
  type GameDetails,
} from '../game'

interface ExportPanelProps {
  analysis: Analysis
  details: GameDetails
  onDetailsChange: (details: GameDetails) => void
}

function fallbackCopy(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export function ExportPanel({
  analysis,
  details,
  onDetailsChange,
}: ExportPanelProps) {
  const [copied, setCopied] = useState(false)

  const pgn = useMemo(() => buildPgn(analysis, details), [analysis, details])
  const analysisUrl = useMemo(() => lichessUrl(analysis, details), [analysis, details])
  const hasMoves = analysis.accepted.length > 0

  function update<K extends keyof GameDetails>(key: K, value: GameDetails[K]) {
    onDetailsChange({ ...details, [key]: value })
  }

  function download() {
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = 'game.pgn'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pgn)
      } else {
        fallbackCopy(pgn)
      }
    } catch {
      fallbackCopy(pgn)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="export-panel" aria-label="Export game">
      <details className="game-details">
        <summary>Game details (optional)</summary>
        <div className="details-grid">
          <label>
            <span>White</span>
            <input
              type="text"
              value={details.white}
              placeholder="?"
              autoComplete="off"
              onChange={(event) => update('white', event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Black</span>
            <input
              type="text"
              value={details.black}
              placeholder="?"
              autoComplete="off"
              onChange={(event) => update('black', event.currentTarget.value)}
            />
          </label>
          <label>
            <span>White Elo</span>
            <input
              type="text"
              inputMode="numeric"
              value={details.whiteElo}
              placeholder="optional"
              autoComplete="off"
              onChange={(event) => update('whiteElo', event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Black Elo</span>
            <input
              type="text"
              inputMode="numeric"
              value={details.blackElo}
              placeholder="optional"
              autoComplete="off"
              onChange={(event) => update('blackElo', event.currentTarget.value)}
            />
          </label>
          <label className="result-field">
            <span>Result</span>
            <select
              value={details.result}
              onChange={(event) => update('result', event.currentTarget.value)}
            >
              {RESULTS.map((result) => (
                <option key={result} value={result}>
                  {result === '*' ? 'Unknown (*)' : result}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      <div className="export-actions">
        <button type="button" className="button" onClick={download}>
          Download PGN
        </button>
        <button type="button" className="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy PGN'}
        </button>
        {hasMoves ? (
          <a
            className="button primary"
            href={analysisUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Lichess
          </a>
        ) : (
          <span className="button primary disabled">Open in Lichess</span>
        )}
      </div>

      <details className="pgn-preview">
        <summary>PGN preview</summary>
        <pre>{pgn}</pre>
      </details>
    </section>
  )
}
