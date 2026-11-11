import { useRef } from 'react'
import type { OcrEngine } from '../ocr'
import { OcrSettings } from './OcrSettings'

interface CaptureStepProps {
  onImage: (file: File) => void
  engine: OcrEngine
  onEngineChange: (engine: OcrEngine) => void
  apiKey: string
  onApiKeyChange: (apiKey: string) => void
}

export function CaptureStep({
  onImage,
  engine,
  onEngineChange,
  apiKey,
  onApiKeyChange,
}: CaptureStepProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  function handleFile(input: HTMLInputElement) {
    const file = input.files?.[0]
    if (file) onImage(file)
    input.value = ''
  }

  return (
    <section className="capture">
      <div className="hero">
        <h1>Chesscribe</h1>
        <p className="lede">
          Photograph a handwritten scoresheet and turn it into a PGN. Use the private
          on-device model or Gemini cloud OCR.
        </p>
      </div>

      <OcrSettings
        engine={engine}
        onEngineChange={onEngineChange}
        apiKey={apiKey}
        onApiKeyChange={onApiKeyChange}
      />

      <div className="capture-actions">
        <button
          type="button"
          className="button primary"
          onClick={() => cameraRef.current?.click()}
        >
          Take a picture
        </button>
        <button
          type="button"
          className="button"
          onClick={() => uploadRef.current?.click()}
        >
          Upload an image
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={(event) => handleFile(event.currentTarget)}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={(event) => handleFile(event.currentTarget)}
      />

      <p className="hint">
        With the local model, the photo never leaves your device and the model is cached
        after the first download.
      </p>
    </section>
  )
}
