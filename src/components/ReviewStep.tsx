import { useState } from 'react'
import type { Analysis, GameDetails } from '../game'
import type { OcrEngine } from '../ocr'
import { BoardPanel } from './BoardPanel'
import { ExportPanel } from './ExportPanel'
import { MoveGrid } from './MoveGrid'
import { OcrSettings } from './OcrSettings'

interface ReviewStepProps {
  analysis: Analysis
  moves: string[]
  onMovesChange: (moves: string[]) => void
  ply: number
  onPlyChange: (ply: number) => void
  details: GameDetails
  onDetailsChange: (details: GameDetails) => void
  status: string
  busy: boolean
  error: string | null
  engine: OcrEngine
  onEngineChange: (engine: OcrEngine) => void
  apiKey: string
  onApiKeyChange: (apiKey: string) => void
  onRetry: () => void
  onDismissError: () => void
  onRecrop: () => void
  onNewPhoto: () => void
}

export function ReviewStep({
  analysis,
  moves,
  onMovesChange,
  ply,
  onPlyChange,
  details,
  onDetailsChange,
  status,
  busy,
  error,
  engine,
  onEngineChange,
  apiKey,
  onApiKeyChange,
  onRetry,
  onDismissError,
  onRecrop,
  onNewPhoto,
}: ReviewStepProps) {
  const [selected, setSelected] = useState<number | null>(null)

  function handleSelect(index: number) {
    setSelected(index)
    const result = analysis.results[index]
    if (result) {
      onPlyChange(result.acceptedAfter)
    } else {
      onPlyChange(Math.max(0, analysis.fens.length - 1))
    }
  }

  return (
    <section className="review-step">
      <header className="review-toolbar">
        <div>
          <h1>Review</h1>
          <p className="hint">
            {analysis.accepted.length} legal move
            {analysis.accepted.length === 1 ? '' : 's'} ·{' '}
            {analysis.results.filter((result) => !result.legal).length} to fix
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="button small"
            onClick={onRetry}
            disabled={busy || !moves.length}
          >
            Re-run
          </button>
          <button type="button" className="button small" onClick={onRecrop}>
            Re-crop
          </button>
          <button type="button" className="button small" onClick={onNewPhoto}>
            New photo
          </button>
        </div>
      </header>

      {(busy || status || error) && (
        <div className={`status-banner${error ? ' error-banner' : ''}`} role="status">
          {busy && <span className="spinner" aria-hidden="true" />}
          <span>{error ?? status}</span>
          {error && !busy && (
            <button type="button" className="button small" onClick={onRetry}>
              Retry
            </button>
          )}
          {error && !busy && (
            <button
              type="button"
              className="button small"
              onClick={onDismissError}
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <OcrSettings
        engine={engine}
        onEngineChange={onEngineChange}
        apiKey={apiKey}
        onApiKeyChange={onApiKeyChange}
        disabled={busy}
        compact
      />

      <BoardPanel
        fens={analysis.fens}
        ply={ply}
        onPlyChange={onPlyChange}
      />

      <MoveGrid
        moves={moves}
        analysis={analysis}
        selected={selected}
        onMovesChange={onMovesChange}
        onSelect={handleSelect}
      />

      <ExportPanel
        analysis={analysis}
        details={details}
        onDetailsChange={onDetailsChange}
      />
    </section>
  )
}
