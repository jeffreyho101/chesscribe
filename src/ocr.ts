import * as ort from 'onnxruntime-web/wasm'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import {
  detectGrid,
  otsuThreshold,
  prepareScoresheet,
  toGrayscale,
  type Box,
  type ImageDataLike,
} from './grid'
import { normalizeSan } from './game'

export const CHARSET = [
  '',
  'K',
  'Q',
  'R',
  'B',
  'N',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  'x',
  '+',
  '#',
  '=',
  'O',
  '-',
] as const

export const INPUT_HEIGHT = 64
export const INPUT_WIDTH = 256
export const MODEL_URL =
  'https://huggingface.co/GerhardTrippen/chess-ocr-bilstm/resolve/main/chess_ocr.onnx'

const MODEL_CACHE = 'chesscribe-model-v1'
const MIN_INK_RATIO = 0.01

export interface RecognizeProgress {
  stage: 'model' | 'grid' | 'cell' | 'done'
  message: string
  ratio?: number
}

export interface RecognizeResult {
  moves: string[]
  recognized: number
  skipped: number
  rows: number
  columns: number
  blocks: number
}

let sessionPromise: Promise<ort.InferenceSession> | null = null

async function readWithProgress(
  response: Response,
  total: number,
  onProgress?: (ratio: number) => void,
): Promise<ArrayBuffer> {
  if (!response.body) return response.arrayBuffer()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    received += value.byteLength
    if (total > 0) onProgress?.(Math.min(1, received / total))
  }

  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged.buffer
}

async function getModelBuffer(
  onProgress?: (ratio: number) => void,
): Promise<ArrayBuffer> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(MODEL_CACHE)
      const cached = await cache.match(MODEL_URL)
      if (cached) {
        onProgress?.(1)
        return await cached.arrayBuffer()
      }
    } catch {
      // Cache Storage can be unavailable in private windows; fall through to fetch.
    }
  }

  const response = await fetch(MODEL_URL)
  if (!response.ok) {
    throw new Error(`Could not download the chess model (${response.status}).`)
  }

  const total = Number(response.headers.get('content-length') ?? 0)
  const buffer = await readWithProgress(response, total, onProgress)

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(MODEL_CACHE)
      await cache.put(MODEL_URL, new Response(buffer.slice(0)))
    } catch {
      // A failed cache write should not stop recognition.
    }
  }

  return buffer
}

export function loadSession(
  onProgress?: (ratio: number) => void,
): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      ort.env.wasm.numThreads = 1
      ort.env.wasm.proxy = false
      ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl }

      const buffer = await getModelBuffer(onProgress)
      return ort.InferenceSession.create(buffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })
    })().catch((error: unknown) => {
      sessionPromise = null
      throw error
    })
  }

  return sessionPromise
}

function sampleBilinear(
  gray: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const clampedX = Math.max(0, Math.min(width - 1, x))
  const clampedY = Math.max(0, Math.min(height - 1, y))
  const x0 = Math.floor(clampedX)
  const y0 = Math.floor(clampedY)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = clampedX - x0
  const fy = clampedY - y0

  const top = gray[y0 * width + x0] * (1 - fx) + gray[y0 * width + x1] * fx
  const bottom = gray[y1 * width + x0] * (1 - fx) + gray[y1 * width + x1] * fx
  return top * (1 - fy) + bottom * fy
}

export function preprocessCell(image: ImageDataLike): Float32Array {
  const { width, height } = image
  const gray = toGrayscale(image)
  const threshold = otsuThreshold(gray)

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    const rowStart = y * width
    for (let x = 0; x < width; x++) {
      if (gray[rowStart + x] <= threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const output = new Float32Array(INPUT_HEIGHT * INPUT_WIDTH).fill(1)

  if (maxX < 0 || maxY < 0) return output

  const pad = 2
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad)
  maxY = Math.min(height - 1, maxY + pad)

  const cropWidth = maxX - minX + 1
  const cropHeight = maxY - minY + 1

  let cropMin = 255
  let cropMax = 0
  for (let y = minY; y <= maxY; y++) {
    const rowStart = y * width
    for (let x = minX; x <= maxX; x++) {
      const value = gray[rowStart + x]
      if (value < cropMin) cropMin = value
      if (value > cropMax) cropMax = value
    }
  }
  const contrast = cropMax > cropMin ? 255 / (cropMax - cropMin) : 0

  const scaledWidth = Math.max(
    1,
    Math.min(INPUT_WIDTH, Math.round((cropWidth / cropHeight) * INPUT_HEIGHT)),
  )
  const offsetX = Math.floor((INPUT_WIDTH - scaledWidth) / 2)

  for (let oy = 0; oy < INPUT_HEIGHT; oy++) {
    const sourceY = minY + ((oy + 0.5) * cropHeight) / INPUT_HEIGHT - 0.5
    for (let ox = 0; ox < scaledWidth; ox++) {
      const sourceX = minX + ((ox + 0.5) * cropWidth) / scaledWidth - 0.5
      const sampled = sampleBilinear(gray, width, height, sourceX, sourceY)
      const value =
        contrast === 0 ? 255 : Math.max(0, Math.min(255, (sampled - cropMin) * contrast))
      output[oy * INPUT_WIDTH + offsetX + ox] = (value / 255 - 0.5) / 0.5
    }
  }

  return output
}

export function ctcDecode(
  output: ArrayLike<number>,
  dims: readonly number[],
): string {
  const classes = CHARSET.length
  const last = dims[dims.length - 1]
  const secondLast = dims[dims.length - 2]

  let timeSteps: number
  let get: (classIndex: number, time: number) => number

  if (last === classes) {
    // The model emits [time, batch, classes] (for example [63, 1, 28]).
    // Classes vary fastest, so the number of decoded frames is length / classes.
    timeSteps = Math.floor(output.length / classes)
    get = (classIndex, time) => output[time * classes + classIndex] ?? 0
  } else if (secondLast === classes) {
    timeSteps = last ?? Math.floor(output.length / classes)
    get = (classIndex, time) => output[classIndex * timeSteps + time] ?? 0
  } else {
    timeSteps = Math.floor(output.length / classes)
    get = (classIndex, time) => output[time * classes + classIndex] ?? 0
  }

  let previous = -1
  let text = ''

  for (let time = 0; time < timeSteps; time++) {
    let bestIndex = 0
    let bestValue = get(0, time)

    for (let classIndex = 1; classIndex < classes; classIndex++) {
      const value = get(classIndex, time)
      if (value > bestValue) {
        bestValue = value
        bestIndex = classIndex
      }
    }

    if (bestIndex !== 0 && bestIndex !== previous) {
      text += CHARSET[bestIndex]
    }
    previous = bestIndex
  }

  return text
}

export function cleanupDecoded(text: string): string {
  return normalizeSan(text)
}

function cropGray(
  gray: Uint8Array,
  width: number,
  box: Box,
): ImageDataLike {
  const data = new Uint8Array(box.width * box.height)
  for (let y = 0; y < box.height; y++) {
    const start = (box.y + y) * width + box.x
    data.set(gray.subarray(start, start + box.width), y * box.width)
  }
  return { data, width: box.width, height: box.height }
}

export async function recognizeScoresheet(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: RecognizeProgress) => void,
): Promise<RecognizeResult> {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Could not read the cropped image.')

  const image = context.getImageData(0, 0, canvas.width, canvas.height)

  onProgress?.({ stage: 'grid', message: 'Straightening and finding the move grid…' })
  const prepared = prepareScoresheet(image)
  const grid = detectGrid(prepared.image)
  const gray = prepared.image.data as Uint8Array

  if (grid.cells.length === 0) {
    throw new Error('No move grid found. Try cropping tighter around the notation.')
  }

  const candidates = grid.cells.filter((cell) => cell.inkRatio >= MIN_INK_RATIO)
  if (candidates.length === 0) {
    throw new Error('The cropped area looks blank. Try cropping around the written moves.')
  }

  const session = await loadSession((ratio) => {
    onProgress?.({
      stage: 'model',
      message: ratio >= 1 ? 'Preparing the model…' : 'Downloading the chess model…',
      ratio,
    })
  })

  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]

  const moves: string[] = []
  let skipped = 0

  for (let index = 0; index < candidates.length; index++) {
    const cell = candidates[index]
    const crop = cropGray(gray, prepared.image.width, cell)
    const input = preprocessCell(crop)
    const tensor = new ort.Tensor('float32', input, [1, 1, INPUT_HEIGHT, INPUT_WIDTH])
    const output = await session.run({ [inputName]: tensor })
    const value = output[outputName]
    const decoded = cleanupDecoded(ctcDecode(value.data as Float32Array, value.dims))

    if (decoded) {
      moves.push(decoded)
    } else {
      skipped++
    }

    onProgress?.({
      stage: 'cell',
      message: `Reading moves… ${index + 1} of ${candidates.length}`,
      ratio: (index + 1) / candidates.length,
    })
  }

  const totalSkipped = skipped + (grid.cells.length - candidates.length)
  onProgress?.({ stage: 'done', message: 'Finished reading the scoresheet.' })

  return {
    moves,
    recognized: moves.length,
    skipped: totalSkipped,
    rows: grid.rows,
    columns: grid.columns,
    blocks: grid.blocks,
  }
}
