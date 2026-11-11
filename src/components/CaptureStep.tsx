import { useRef } from 'react'

interface CaptureStepProps {
  onImage: (file: File) => void
}

export function CaptureStep({ onImage }: CaptureStepProps) {
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
          Photograph a handwritten scoresheet and turn it into a PGN. Everything runs on
          this device.
        </p>
      </div>

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
        The photo never leaves your device. The app downloads the recognition model once
        and caches it in the browser.
      </p>
    </section>
  )
}
