import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { recognizeWithGemini } from './cloudOcr'
import { CaptureStep } from './components/CaptureStep'
import { CropStep } from './components/CropStep'
import { ReviewStep } from './components/ReviewStep'
import { DEFAULT_DETAILS, analyzeMoves, type GameDetails } from './game'
import { recognizeScoresheet, type OcrEngine } from './ocr'

type Step = 'capture' | 'crop' | 'review'

const ENGINE_KEY = 'chesscribe-engine'
const GEMINI_KEY = 'chesscribe-gemini-key'

function loadEngine(): OcrEngine {
  try {
    return localStorage.getItem(ENGINE_KEY) === 'gemini' ? 'gemini' : 'local'
  } catch {
    return 'local'
  }
}

function loadApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveSetting(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Private windows can disable storage; keep the value for this session only.
  }
}

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
  const [engine, setEngine] = useState<OcrEngine>(loadEngine)
  const [apiKey, setApiKey] = useState(loadApiKey)

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

  function handleEngineChange(next: OcrEngine) {
    setEngine(next)
    saveSetting(ENGINE_KEY, next)
  }

  function handleApiKeyChange(next: string) {
    setApiKey(next)
    saveSetting(GEMINI_KEY, next)
  }

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
      const onProgress = (progress: { message: string }) => {
        if (runId === runIdRef.current) setStatus(progress.message)
      }

      const result =
        engine === 'gemini'
          ? await recognizeWithGemini(canvas, apiKey, onProgress)
          : await recognizeScoresheet(canvas, onProgress)
      if (runId !== runIdRef.current) return

      setMoves(result.moves.length > 0 ? result.moves : ['', ''])
      setPly(0)

      const blockWord = result.blocks === 1 ? 'block' : 'blocks'
      const summary =
        result.engine === 'gemini'
          ? `Read ${result.recognized} moves with Gemini.`
          : `Read ${result.recognized} moves from ${result.rows} rows and ${result.columns} move columns (${result.blocks} ${blockWord}).`
      setStatus(
        result.recognized > 0
          ? summary
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
  }, [apiKey, engine])

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
      {step === 'capture' && (
        <CaptureStep
          onImage={handleImage}
          engine={engine}
          onEngineChange={handleEngineChange}
          apiKey={apiKey}
          onApiKeyChange={handleApiKeyChange}
        />
      )}

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
          engine={engine}
          onEngineChange={handleEngineChange}
          apiKey={apiKey}
          onApiKeyChange={handleApiKeyChange}
          onRetry={handleRetry}
          onDismissError={() => setError(null)}
          onRecrop={handleRecrop}
          onNewPhoto={handleNewPhoto}
        />
      )}
    </div>
  )
}
