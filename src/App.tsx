import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CaptureStep } from './components/CaptureStep'
import { CropStep } from './components/CropStep'
import { ReviewStep } from './components/ReviewStep'
import { DEFAULT_DETAILS, analyzeMoves, type GameDetails } from './game'
import { recognizeScoresheet } from './ocr'

type Step = 'capture' | 'crop' | 'review'

export default function App() {
  const [step, setStep] = useState<Step>('capture')
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [cropped, setCropped] = useState<HTMLCanvasElement | null>(null)
  const [moves, setMoves] = useState<string[]>([])
  const [ply, setPly] = useState(0)
  const [details, setDetails] = useState<GameDetails>(DEFAULT_DETAILS)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const imageUrlRef = useRef<string | null>(null)
  const runIdRef = useRef(0)

  const analysis = useMemo(() => analyzeMoves(moves), [moves])

  useEffect(() => {
    setPly((current) => Math.min(current, analysis.fens.length - 1))
  }, [analysis.fens.length])

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
      runIdRef.current++
    }
  }, [])

  function handleImage(file: File) {
    const url = URL.createObjectURL(file)
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    imageUrlRef.current = url
    runIdRef.current++

    setImageSrc(url)
    setCropped(null)
    setMoves([])
    setPly(0)
    setDetails(DEFAULT_DETAILS)
    setStatus('')
    setError(null)
    setBusy(false)
    setStep('crop')
  }

  const runRecognition = useCallback(async (canvas: HTMLCanvasElement) => {
    const runId = ++runIdRef.current

    setCropped(canvas)
    setStep('review')
    setMoves([])
    setPly(0)
    setBusy(true)
    setError(null)
    setStatus('Preparing…')

    try {
      const result = await recognizeScoresheet(canvas, (progress) => {
        if (runId === runIdRef.current) setStatus(progress.message)
      })
      if (runId !== runIdRef.current) return

      setMoves(result.moves.length > 0 ? result.moves : ['', ''])
      setPly(0)

      const blockWord = result.blocks === 1 ? 'block' : 'blocks'
      setStatus(
        result.recognized > 0
          ? `Read ${result.recognized} moves from ${result.rows} rows and ${result.columns} move columns (${result.blocks} ${blockWord}).`
          : 'No moves were recognized. Type or correct them below.',
      )
      if (result.recognized === 0) {
        setError('No moves were recognized. You can type them in below.')
      }
    } catch (cause) {
      if (runId !== runIdRef.current) return
      setMoves(['', ''])
      setStatus('')
      setError(cause instanceof Error ? cause.message : 'Recognition failed.')
    } finally {
      if (runId === runIdRef.current) setBusy(false)
    }
  }, [])

  function handleRetry() {
    if (cropped) void runRecognition(cropped)
  }

  function handleNewPhoto() {
    runIdRef.current++
    setBusy(false)
    setStep('capture')
  }

  function handleRecrop() {
    runIdRef.current++
    setBusy(false)
    setError(null)
    setStep('crop')
  }

  return (
    <div className="app">
      {step === 'capture' && <CaptureStep onImage={handleImage} />}

      {step === 'crop' && imageSrc && (
        <CropStep
          src={imageSrc}
          onCancel={() => setStep('capture')}
          onConfirm={runRecognition}
        />
      )}

      {step === 'review' && (
        <ReviewStep
          analysis={analysis}
          moves={moves}
          onMovesChange={setMoves}
          ply={ply}
          onPlyChange={setPly}
          details={details}
          onDetailsChange={setDetails}
          status={status}
          busy={busy}
          error={error}
          onRetry={handleRetry}
          onDismissError={() => setError(null)}
          onRecrop={handleRecrop}
          onNewPhoto={handleNewPhoto}
        />
      )}
    </div>
  )
}
