import { describe, expect, it } from 'vitest'
import {
  cleanCloudMove,
  cleanupCloudMoves,
  parseGeminiResponse,
} from './cloudOcr'

describe('cleanCloudMove', () => {
  it('removes move numbers and clock annotations', () => {
    expect(cleanCloudMove('1. e4')).toBe('e4')
    expect(cleanCloudMove('12...Nf6')).toBe('Nf6')
    expect(cleanCloudMove('e4 00:12')).toBe('e4')
    expect(cleanCloudMove('Bxd3 [1:03]')).toBe('Bxd3')
  })

  it('drops timestamps, results, and empty entries', () => {
    expect(cleanCloudMove('00:12')).toBe('')
    expect(cleanCloudMove('[1:03]')).toBe('')
    expect(cleanCloudMove('1-0')).toBe('')
    expect(cleanCloudMove('')).toBe('')
  })
})

describe('cleanupCloudMoves', () => {
  it('keeps only readable moves', () => {
    expect(
      cleanupCloudMoves(['1. e4', '00:12', 'e5', '1-0', 'Nf3 0:42', 42]),
    ).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('returns an empty list for invalid input', () => {
    expect(cleanupCloudMoves(null)).toEqual([])
  })
})

describe('parseGeminiResponse', () => {
  it('reads a JSON move list', () => {
    expect(
      parseGeminiResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"moves":["1. e4","e5 0:12","Nf3"]}',
                },
              ],
            },
          },
        ],
      }),
    ).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('accepts fenced JSON and bare arrays', () => {
    expect(
      parseGeminiResponse({
        candidates: [{ content: { parts: [{ text: '```json\n["e4", "e5"]\n```' }] } }],
      }),
    ).toEqual(['e4', 'e5'])
  })

  it('throws a helpful error for an empty response', () => {
    expect(() => parseGeminiResponse({ candidates: [] })).toThrow(/empty response/)
  })
})
