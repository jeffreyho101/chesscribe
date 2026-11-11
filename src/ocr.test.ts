import { describe, expect, it } from 'vitest'
import { CHARSET, cleanupDecoded, ctcDecode } from './ocr'

function classIndex(character: string): number {
  return CHARSET.indexOf(character as (typeof CHARSET)[number])
}

function timeMajorLogits(classes: number[]): {
  data: Float32Array
  dims: number[]
} {
  const data = new Float32Array(classes.length * CHARSET.length).fill(-10)
  classes.forEach((classIndexValue, time) => {
    data[time * CHARSET.length + classIndexValue] = 10
  })
  return { data, dims: [1, classes.length, CHARSET.length] }
}

describe('ctcDecode', () => {
  it('collapses repeats and drops blanks', () => {
    const blank = 0
    const e = classIndex('e')
    const four = classIndex('4')

    const { data, dims } = timeMajorLogits([e, e, blank, four, four, blank])

    expect(ctcDecode(data, dims)).toBe('e4')
  })

  it('keeps a repeated character when a blank separates it', () => {
    const e = classIndex('e')
    const { data, dims } = timeMajorLogits([e, 0, e])

    expect(ctcDecode(data, dims)).toBe('ee')
  })

  it('decodes the model [time, batch, classes] layout', () => {
    const e = classIndex('e')
    const four = classIndex('4')
    const time = 6
    const classes = CHARSET.length
    const data = new Float32Array(time * 1 * classes).fill(-10)

    ;[e, e, 0, four, four, 0].forEach((classIndexValue, t) => {
      data[t * classes + classIndexValue] = 10
    })

    expect(ctcDecode(data, [time, 1, classes])).toBe('e4')
  })

  it('supports class-major output', () => {
    const n = classIndex('N')
    const f = classIndex('f')
    const three = classIndex('3')
    const time = 3
    const classes = CHARSET.length
    const data = new Float32Array(classes * time).fill(-10)

    const sequence = [n, f, three]
    sequence.forEach((classIndexValue, t) => {
      data[classIndexValue * time + t] = 10
    })

    expect(ctcDecode(data, [1, classes, time])).toBe('Nf3')
  })
})

describe('cleanupDecoded', () => {
  it('normalizes castling and colon captures', () => {
    expect(cleanupDecoded('0-0')).toBe('O-O')
    expect(cleanupDecoded('B:d3')).toBe('Bxd3')
  })
})
