import type { Analysis } from '../game'

interface MoveGridProps {
  moves: string[]
  analysis: Analysis
  selected: number | null
  onMovesChange: (moves: string[]) => void
  onSelect: (index: number) => void
}

export function MoveGrid({
  moves,
  analysis,
  selected,
  onMovesChange,
  onSelect,
}: MoveGridProps) {
  const rowCount = Math.max(1, Math.ceil(moves.length / 2))

  function setMove(index: number, value: string) {
    const next = moves.slice()
    while (next.length <= index) next.push('')
    next[index] = value
    onMovesChange(next)
  }

  return (
    <section className="move-grid-panel" aria-label="Editable moves">
      <div className="move-grid-heading">
        <h2>Moves</h2>
        <p className="hint">Red moves are illegal or could not be parsed.</p>
      </div>

      <div className="move-grid">
        <div className="move-grid-row move-grid-header" aria-hidden="true">
          <span className="move-number">#</span>
          <span>White</span>
          <span>Black</span>
        </div>

        {Array.from({ length: rowCount }, (_, row) => {
          const whiteIndex = row * 2
          const blackIndex = row * 2 + 1

          return (
            <div className="move-grid-row" key={row}>
              <span className="move-number">{row + 1}.</span>
              <MoveCell
                index={whiteIndex}
                label={`White move ${row + 1}`}
                moves={moves}
                analysis={analysis}
                selected={selected}
                onChange={setMove}
                onSelect={onSelect}
              />
              <MoveCell
                index={blackIndex}
                label={`Black move ${row + 1}`}
                moves={moves}
                analysis={analysis}
                selected={selected}
                onChange={setMove}
                onSelect={onSelect}
              />
            </div>
          )
        })}
      </div>

      <div className="move-grid-actions">
        <button
          type="button"
          className="button"
          onClick={() => onMovesChange([...moves, '', ''])}
        >
          Add row
        </button>
        <button
          type="button"
          className="button"
          onClick={() => onMovesChange(moves.slice(0, Math.max(0, moves.length - 2)))}
          disabled={moves.length === 0}
        >
          Remove last row
        </button>
      </div>
    </section>
  )
}

interface MoveCellProps {
  index: number
  label: string
  moves: string[]
  analysis: Analysis
  selected: number | null
  onChange: (index: number, value: string) => void
  onSelect: (index: number) => void
}

function MoveCell({
  index,
  label,
  moves,
  analysis,
  selected,
  onChange,
  onSelect,
}: MoveCellProps) {
  const value = moves[index] ?? ''
  const result = analysis.results[index]
  const illegal = value.trim().length > 0 && result ? !result.legal : false

  return (
    <input
      type="text"
      className={`move-input${illegal ? ' illegal' : ''}${
        selected === index ? ' selected' : ''
      }`}
      value={value}
      aria-label={label}
      aria-invalid={illegal}
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="next"
      onChange={(event) => onChange(index, event.currentTarget.value)}
      onFocus={() => onSelect(index)}
      onClick={() => onSelect(index)}
    />
  )
}
