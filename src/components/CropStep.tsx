import { useRef, useState } from 'react'
import ReactCrop, {
  convertToPixelCrop,
  cropToCanvas,
  type Crop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface CropStepProps {
  src: string
  onCancel: () => void
  onConfirm: (canvas: HTMLCanvasElement) => void
}

const FULL_CROP: Crop = { unit: '%', x: 0, y: 0, width: 100, height: 100 }

export function CropStep({ src, onCancel, onConfirm }: CropStepProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>(FULL_CROP)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    const image = imageRef.current
    if (!image || !image.width) return

    const pixelCrop = convertToPixelCrop(crop, image.width, image.height)
    if (pixelCrop.width < 10 || pixelCrop.height < 10) {
      setError('Drag the crop handles around the written moves.')
      return
    }

    setBusy(true)
    setError(null)

    try {
      const canvas = document.createElement('canvas')
      await cropToCanvas(image, canvas, pixelCrop)
      onConfirm(canvas)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not crop the image.')
      setBusy(false)
    }
  }

  return (
    <section className="crop-step">
      <header className="step-header">
        <h2>Crop the notation</h2>
        <p>Drag the handles so only the written move table is inside the box.</p>
      </header>

      <div className="crop-stage">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          ruleOfThirds
        >
          <img
            ref={imageRef}
            src={src}
            alt="Scoresheet"
            className="crop-image"
          />
        </ReactCrop>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="step-actions">
        <button type="button" className="button" onClick={onCancel}>
          Back
        </button>
        <button
          type="button"
          className="button primary"
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy ? 'Cropping…' : 'Use this crop'}
        </button>
      </div>
    </section>
  )
}
