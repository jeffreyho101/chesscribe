import type { OcrEngine } from '../ocr'

interface OcrSettingsProps {
  engine: OcrEngine
  onEngineChange: (engine: OcrEngine) => void
  apiKey: string
  onApiKeyChange: (apiKey: string) => void
  disabled?: boolean
  compact?: boolean
}

export function OcrSettings({
  engine,
  onEngineChange,
  apiKey,
  onApiKeyChange,
  disabled = false,
  compact = false,
}: OcrSettingsProps) {
  return (
    <section
      className={`ocr-settings${compact ? ' compact' : ''}`}
      aria-label="OCR engine"
    >
      <div className="ocr-settings-heading">
        <h2>Recognition</h2>
        <p className="hint">
          Use the on-device model or Gemini for cloud OCR.
        </p>
      </div>

      <div className="segmented-control" role="group" aria-label="OCR engine">
        <button
          type="button"
          className={engine === 'local' ? 'active' : ''}
          aria-pressed={engine === 'local'}
          disabled={disabled}
          onClick={() => onEngineChange('local')}
        >
          Local model
        </button>
        <button
          type="button"
          className={engine === 'gemini' ? 'active' : ''}
          aria-pressed={engine === 'gemini'}
          disabled={disabled}
          onClick={() => onEngineChange('gemini')}
        >
          Gemini (cloud)
        </button>
      </div>

      {engine === 'local' ? (
        <p className="hint">
          Private and offline after the first model download. Best for clean scoresheets.
        </p>
      ) : (
        <>
          <label className="api-key-field">
            <span>Gemini API key</span>
            <input
              type="password"
              value={apiKey}
              placeholder="Paste your API key"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              onChange={(event) => onApiKeyChange(event.currentTarget.value)}
            />
          </label>
          <p className="hint">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Get a free Gemini API key
            </a>
            . The key is stored in this browser and the cropped scoresheet is sent to
            Google.
          </p>
        </>
      )}
    </section>
  )
}
