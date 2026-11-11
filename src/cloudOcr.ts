import { RESULTS, normalizeSan } from './game'
import type { RecognizeProgress, RecognizeResult } from './ocr'

export const GEMINI_MODEL = 'gemini-3.5-flash'
export const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const PROMPT = `You are extracting chess moves from a photo of a handwritten chess scoresheet.

Return every move of the game in order as JSON: {"moves": ["e4", "e5", ...]}.
Use standard algebraic notation (SAN).

Rules:
- Read White and Black move columns from top to bottom, interleaving them in game order.
- Ignore move numbers, results, player names, dates, headers, and crossed-out moves.
- Ignore any annotations that are not part of a move, especially clock times and
  timestamps (for example 00:12, 1:03, or 12:34:56).
- If a move cannot be read, use an empty string instead of guessing.
- Never invent moves or repeat a move that is not written.`

interface GeminiPart {
  text?: string
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[]
  }
  finishReason?: string
}

interface GeminiResponse {
  candidates?: GeminiCandidate[]
  promptFeedback?: {
    blockReason?: string
  }
  error?: {
    message?: string
  }
}

function moveNumberPattern(value: string): boolean {
  return /^\d+\.(?:\.\.)?$/.test(value)
}

function timestampPattern(value: string): boolean {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)
}

export function cleanCloudMove(raw: string): string {
  let value = raw.trim()
  if (!value) return ''

  value = value.replace(/^(?:\d+\.(?:\.\.)?\s*)+/, '')
  value = value.replace(/\s*[([{]?\d{1,2}:\d{2}(?::\d{2})?[)\]} ]?\s*$/, '')

  const san = normalizeSan(value)
  if (!san) return ''
  if (moveNumberPattern(san) || timestampPattern(san)) return ''
  if (RESULTS.includes(san as (typeof RESULTS)[number])) return ''
  return san
}

export function cleanupCloudMoves(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((item): item is string => typeof item === 'string')
    .map(cleanCloudMove)
    .filter((move) => move.length > 0)
}

function responseText(payload: GeminiResponse): string {
  const text = (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim()

  if (text) return text

  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request (${payload.promptFeedback.blockReason}).`)
  }

  const finishReason = payload.candidates?.[0]?.finishReason
  if (finishReason) {
    throw new Error(`Gemini did not return an answer (${finishReason}).`)
  }

  throw new Error('Gemini returned an empty response.')
}

export function parseGeminiResponse(payload: unknown): string[] {
  const data = payload as GeminiResponse
  if (data.error?.message) throw new Error(data.error.message)

  const text = responseText(data)
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(withoutFence)
  } catch {
    const start = withoutFence.indexOf('{')
    const end = withoutFence.lastIndexOf('}')
    if (start === -1 || end <= start) {
      throw new Error('Gemini returned an unexpected response. Try again.')
    }
    parsed = JSON.parse(withoutFence.slice(start, end + 1))
  }

  const moves =
    Array.isArray(parsed) || parsed === null || typeof parsed !== 'object'
      ? parsed
      : (parsed as { moves?: unknown }).moves

  if (!Array.isArray(moves)) {
    throw new Error('Gemini did not return a list of moves. Try again.')
  }

  return cleanupCloudMoves(moves)
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as GeminiResponse
    return payload.error?.message ?? ''
  } catch {
    return ''
  }
}

export async function recognizeWithGemini(
  canvas: HTMLCanvasElement,
  apiKey: string,
  onProgress?: (progress: RecognizeProgress) => void,
): Promise<RecognizeResult> {
  const key = apiKey.trim()
  if (!key) {
    throw new Error('Enter a Gemini API key to use the cloud model.')
  }

  onProgress?.({ stage: 'model', message: 'Sending the scoresheet to Gemini…' })

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            moves: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['moves'],
        },
      },
    }),
  })

  if (!response.ok) {
    const detail = await errorMessage(response)
    if (response.status === 401 || response.status === 403) {
      throw new Error('Gemini rejected the API key. Check the key and try again.')
    }
    if (response.status === 429) {
      throw new Error('Gemini rate limit reached. Wait a moment and try again.')
    }
    throw new Error(
      detail
        ? `Gemini request failed: ${detail}`
        : `Gemini request failed (${response.status}).`,
    )
  }

  const payload = (await response.json()) as GeminiResponse
  const moves = parseGeminiResponse(payload)

  onProgress?.({ stage: 'done', message: 'Gemini finished reading the scoresheet.' })

  return {
    engine: 'gemini',
    moves,
    recognized: moves.length,
    skipped: 0,
    rows: Math.ceil(moves.length / 2),
    columns: 2,
    blocks: 1,
  }
}
