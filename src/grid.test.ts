import { describe, expect, it } from 'vitest'
import { detectGrid, type ImageDataLike } from './grid'

interface SheetOptions {
  width: number
  height: number
  verticalLines: number[]
  horizontalLines: number[]
}

function makeSheet({
  width,
  height,
  verticalLines,
  horizontalLines,
}: SheetOptions): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)

  function dark(x: number, y: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const index = (y * width + x) * 4
    data[index] = 0
    data[index + 1] = 0
    data[index + 2] = 0
  }

  for (const x of verticalLines) {
    for (let y = horizontalLines[0]; y <= horizontalLines[horizontalLines.length - 1]; y++) {
      for (let thickness = 0; thickness < 2; thickness++) dark(x + thickness, y)
    }
  }

  for (const y of horizontalLines) {
    for (let x = verticalLines[0]; x <= verticalLines[verticalLines.length - 1]; x++) {
      for (let thickness = 0; thickness < 2; thickness++) dark(x, y + thickness)
    }
  }

  return { data, width, height }
}

function addText(
  sheet: ImageDataLike,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  for (let row = y; row < y + height; row++) {
    for (let column = x; column < x + width; column++) {
      if ((column + row) % 3 === 0) {
        const index = (row * sheet.width + column) * 4
        sheet.data[index] = 20
        sheet.data[index + 1] = 20
        sheet.data[index + 2] = 20
      }
    }
  }
}

describe('detectGrid', () => {
  it('skips the narrow move-number column and orders White then Black', () => {
    const sheet = makeSheet({
      width: 280,
      height: 120,
      verticalLines: [10, 60, 160, 260],
      horizontalLines: [10, 50, 90],
    })

    addText(sheet, 80, 25, 50, 15)
    addText(sheet, 180, 25, 50, 15)
    addText(sheet, 80, 65, 50, 15)
    addText(sheet, 180, 65, 50, 15)

    const grid = detectGrid(sheet)

    expect(grid.blocks).toBe(1)
    expect(grid.rows).toBe(2)
    expect(grid.columns).toBe(2)
    expect(grid.cells.map((cell) => cell.color)).toEqual([
      'white',
      'black',
      'white',
      'black',
    ])
    expect(grid.cells[0].x).toBeGreaterThan(50)
    expect(grid.cells[1].x).toBeGreaterThan(150)
    expect(grid.cells.every((cell) => cell.inkRatio > 0)).toBe(true)
  })

  it('discovers multiple blocks instead of assuming two columns', () => {
    const sheet = makeSheet({
      width: 510,
      height: 120,
      verticalLines: [10, 50, 150, 250, 290, 390, 490],
      horizontalLines: [10, 50, 90],
    })

    for (const x of [70, 170, 310, 410]) {
      addText(sheet, x, 25, 50, 15)
      addText(sheet, x, 65, 50, 15)
    }

    const grid = detectGrid(sheet)

    expect(grid.blocks).toBe(2)
    expect(grid.rows).toBe(2)
    expect(grid.columns).toBe(4)
    expect(grid.cells).toHaveLength(8)
    expect(grid.cells.map((cell) => cell.block)).toEqual([0, 0, 0, 0, 1, 1, 1, 1])
    expect(grid.cells.map((cell) => cell.color)).toEqual([
      'white',
      'black',
      'white',
      'black',
      'white',
      'black',
      'white',
      'black',
    ])
    expect(grid.cells[4].x).toBeGreaterThan(250)
  })

  it('returns no cells when there are no ruled lines', () => {
    const sheet: ImageDataLike = {
      data: new Uint8ClampedArray(100 * 100 * 4).fill(255),
      width: 100,
      height: 100,
    }

    expect(detectGrid(sheet).cells).toEqual([])
  })
})
