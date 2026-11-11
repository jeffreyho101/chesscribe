import { Chessboard } from 'react-chessboard'

interface BoardPanelProps {
  fens: string[]
  ply: number
  onPlyChange: (ply: number) => void
}

export function BoardPanel({ fens, ply, onPlyChange }: BoardPanelProps) {
  const last = Math.max(0, fens.length - 1)
  const current = Math.max(0, Math.min(ply, last))
  const fen = fens[current] ?? fens[0]

  return (
    <section className="board-panel" aria-label="Board and move stepper">
      <div className="board-wrap">
        <Chessboard
          options={{
            position: fen,
            allowDragging: false,
            showNotation: true,
            animationDurationInMs: 160,
          }}
        />
      </div>

      <div className="stepper">
        <button
          type="button"
          className="stepper-button"
          onClick={() => onPlyChange(0)}
          disabled={current === 0}
          aria-label="Go to starting position"
        >
          Start
        </button>
        <button
          type="button"
          className="stepper-button"
          onClick={() => onPlyChange(Math.max(0, current - 1))}
          disabled={current === 0}
          aria-label="Previous move"
        >
          Back
        </button>
        <span className="ply-readout" aria-live="polite">
          {current === 0 ? 'Starting position' : `Ply ${current} of ${last}`}
        </span>
        <button
          type="button"
          className="stepper-button"
          onClick={() => onPlyChange(Math.min(last, current + 1))}
          disabled={current >= last}
          aria-label="Next move"
        >
          Next
        </button>
        <button
          type="button"
          className="stepper-button"
          onClick={() => onPlyChange(last)}
          disabled={current >= last}
          aria-label="Go to final position"
        >
          End
        </button>
      </div>
    </section>
  )
}
