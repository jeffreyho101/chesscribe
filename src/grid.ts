export interface ImageDataLike {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface GridCell extends Box {
  row: number
  block: number
  color: 'white' | 'black'
  inkRatio: number
}

export interface GridResult {
  cells: GridCell[]
  verticalLines: number[]
  horizontalLines: number[]
  rows: number
  columns: number
  blocks: number
}

export interface DetectOptions {
  lineRatio?: number
  labelWidthRatio?: number
  insetRatio?: number
}

interface Interval {
  start: number
  end: number
  width: number
}

export function toGrayscale(image: ImageDataLike): Uint8Array {
  const { data, width, height } = image
  const pixels = width * height
  const gray = new Uint8Array(pixels)

  if (data.length === pixels) {
    gray.set(data)
    return gray
  }

  for (let i = 0; i < pixels; i++) {
    const j = i * 4
    gray[i] = Math.round(
      0.299 * (data[j] ?? 0) + 0.587 * (data[j + 1] ?? 0) + 0.114 * (data[j + 2] ?? 0),
    )
  }
  return gray
}

export function otsuThreshold(gray: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0)

  for (let i = 0; i < gray.length; i++) histogram[gray[i]]++

  let total = gray.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]

  let sumBackground = 0
  let weightBackground = 0
  let maxVariance = -1
  let threshold = 127

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t]
    if (weightBackground === 0) continue

    const weightForeground = total - weightBackground
    if (weightForeground === 0) break

    sumBackground += t * histogram[t]
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sum - sumBackground) / weightForeground
    const variance =
      weightBackground * weightForeground * (meanBackground - meanForeground) ** 2

    if (variance > maxVariance) {
      maxVariance = variance
      threshold = t
    }
  }

  return threshold
}

function highPass(projection: number[], window: number): number[] {
  const size = projection.length
  const half = Math.max(1, Math.floor(window / 2))
  const prefix = new Float64Array(size + 1)

  for (let i = 0; i < size; i++) prefix[i + 1] = prefix[i] + projection[i]

  const result = new Array<number>(size)
  for (let i = 0; i < size; i++) {
    const from = Math.max(0, i - half)
    const to = Math.min(size, i + half + 1)
    result[i] = projection[i] - (prefix[to] - prefix[from]) / (to - from)
  }
  return result
}

function findLines(projection: number[], size: number, ratio: number): number[] {
  const score = highPass(projection, Math.max(9, Math.round(size * 0.02)))

  let max = 0
  for (const value of score) if (value > max) max = value
  if (max <= 0) return []

  const threshold = max * ratio
  const groups: number[] = []
  const centers: number[] = []

  let start = -1
  for (let i = 0; i <= score.length; i++) {
    const above = i < score.length && score[i] >= threshold
    if (above && start === -1) {
      start = i
    } else if (!above && start !== -1) {
      groups.push(start, i - 1)
      start = -1
    }
  }

  const maxThickness = Math.max(5, Math.round(size * 0.015))

  for (let g = 0; g < groups.length; g += 2) {
    const from = groups[g]
    const to = groups[g + 1]
    if (to - from + 1 > maxThickness) continue

    let weightSum = 0
    let weightedPosition = 0
    for (let i = from; i <= to; i++) {
      weightSum += projection[i]
      weightedPosition += projection[i] * i
    }
    centers.push(weightSum > 0 ? weightedPosition / weightSum : (from + to) / 2)
  }

  const minGap = Math.max(2, Math.round(size * 0.008))
  const lines: number[] = []
  for (const center of centers) {
    const previous = lines[lines.length - 1]
    if (previous !== undefined && center - previous < minGap) {
      lines[lines.length - 1] = (previous + center) / 2
    } else {
      lines.push(center)
    }
  }

  return lines
}

function estimatePeriod(projection: number[], size: number): number | null {
  if (size < 240) return null

  const score = highPass(projection, Math.max(9, Math.round(size * 0.02)))
  const minLag = Math.max(6, Math.round(size * 0.02))
  const maxLag = Math.min(size - 2, Math.round(size * 0.12))
  if (maxLag <= minLag) return null

  let bestScore = -Infinity
  let bestLag = 0

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i < size - lag; i++) sum += score[i] * score[i + lag]
    const normalized = sum / (size - lag)
    if (normalized > bestScore) {
      bestScore = normalized
      bestLag = lag
    }
  }

  return bestLag > 0 ? bestLag : null
}

function regularizeLines(
  lines: number[],
  projection: number[],
  size: number,
): number[] {
  if (lines.length < 4) return lines

  const period = estimatePeriod(projection, size)
  if (!period) return lines

  const minGap = period * 0.6
  const maxGap = period * 1.6
  const result: number[] = [lines[0]]
  let index = 0

  for (;;) {
    const current = result[result.length - 1]
    let bestIndex = -1
    let bestGap = 0
    let bestDeviation = Infinity

    for (let i = index + 1; i < lines.length; i++) {
      const gap = lines[i] - current
      if (gap < minGap) continue
      if (gap > maxGap) break
      const deviation = Math.abs(gap - period)
      if (deviation < bestDeviation) {
        bestDeviation = deviation
        bestGap = gap
        bestIndex = i
      }
    }

    if (bestIndex === -1) {
      const skipMax = period * 2.6
      for (let i = index + 1; i < lines.length; i++) {
        const gap = lines[i] - current
        if (gap < maxGap) continue
        if (gap > skipMax) break
        const missing = Math.max(1, Math.round(gap / period) - 1)
        const target = period * (missing + 1)
        const deviation = Math.abs(gap - target)
        if (deviation < bestDeviation) {
          bestDeviation = deviation
          bestGap = gap
          bestIndex = i
        }
      }
    }

    if (bestIndex === -1) break

    if (bestGap > maxGap) {
      let next = current + period
      while (next < lines[bestIndex] - minGap) {
        result.push(next)
        next += period
      }
    }

    result.push(lines[bestIndex])
    index = bestIndex
  }

  return result
}

function toIntervals(lines: number[], minSize: number): Interval[] {
  const intervals: Interval[] = []
  for (let i = 0; i < lines.length - 1; i++) {
    const start = Math.round(lines[i])
    const end = Math.round(lines[i + 1])
    const width = end - start
    if (width >= minSize) intervals.push({ start, end, width })
  }
  return intervals
}

function insetBox(
  box: Box,
  ratio: number,
  maxX: number,
  maxY: number,
): Box {
  const padX = Math.max(1, Math.round(box.width * ratio))
  const padY = Math.max(1, Math.round(box.height * ratio))

  const x = Math.min(maxX - 1, box.x + padX)
  const y = Math.min(maxY - 1, box.y + padY)
  const width = Math.max(1, Math.min(maxX - x, box.width - padX * 2))
  const height = Math.max(1, Math.min(maxY - y, box.height - padY * 2))

  return { x, y, width, height }
}

function inkRatioIn(
  gray: Uint8Array,
  width: number,
  box: Box,
  threshold: number,
): number {
  let ink = 0
  for (let y = box.y; y < box.y + box.height; y++) {
    const rowStart = y * width
    for (let x = box.x; x < box.x + box.width; x++) {
      if (gray[rowStart + x] <= threshold) ink++
    }
  }
  return ink / (box.width * box.height)
}

function sampleGray(
  gray: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return 255

  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0

  const top = gray[y0 * width + x0] * (1 - fx) + gray[y0 * width + x1] * fx
  const bottom = gray[y1 * width + x0] * (1 - fx) + gray[y1 * width + x1] * fx
  return top * (1 - fy) + bottom * fy
}

export function rotateGrayscale(
  gray: Uint8Array,
  width: number,
  height: number,
  angle: number,
): Uint8Array {
  if (angle === 0) return gray

  const radians = (angle * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const centerX = (width - 1) / 2
  const centerY = (height - 1) / 2
  const output = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    const dy = y - centerY
    const rowStart = y * width
    for (let x = 0; x < width; x++) {
      const dx = x - centerX
      const sourceX = centerX + dx * cos - dy * sin
      const sourceY = centerY + dx * sin + dy * cos
      output[rowStart + x] = Math.round(
        sampleGray(gray, width, height, sourceX, sourceY),
      )
    }
  }

  return output
}

function downsampleGray(
  gray: Uint8Array,
  width: number,
  height: number,
  maxSize: number,
): { gray: Uint8Array; width: number; height: number } {
  const scale = Math.min(1, maxSize / Math.max(width, height))
  if (scale === 1) return { gray, width, height }

  const scaledWidth = Math.max(1, Math.round(width * scale))
  const scaledHeight = Math.max(1, Math.round(height * scale))
  const output = new Uint8Array(scaledWidth * scaledHeight)

  for (let y = 0; y < scaledHeight; y++) {
    const sourceY = Math.min(height - 1, Math.floor(y / scale))
    for (let x = 0; x < scaledWidth; x++) {
      const sourceX = Math.min(width - 1, Math.floor(x / scale))
      output[y * scaledWidth + x] = gray[sourceY * width + sourceX]
    }
  }

  return { gray: output, width: scaledWidth, height: scaledHeight }
}

function verticalLineScore(
  gray: Uint8Array,
  width: number,
  height: number,
  gap: number,
): number {
  const projection = new Array<number>(width).fill(0)

  for (let y = 0; y < height; y++) {
    const rowStart = y * width
    for (let x = gap; x < width - gap; x++) {
      const response =
        Math.min(gray[rowStart + x - gap], gray[rowStart + x + gap]) -
        gray[rowStart + x]
      if (response > 0) projection[x] += response
    }
  }

  let mean = 0
  for (const value of projection) mean += value
  mean /= width

  let variance = 0
  for (const value of projection) variance += (value - mean) ** 2
  return variance
}

export function estimateSkewAngle(
  gray: Uint8Array,
  width: number,
  height: number,
): number {
  if (Math.max(width, height) < 240) return 0

  const small = downsampleGray(gray, width, height, 400)
  const gap = Math.max(2, Math.round(small.width * 0.01))

  let bestAngle = 0
  let bestScore = -Infinity
  let zeroScore = 0

  for (let step = -10; step <= 10; step++) {
    const angle = step * 0.5
    const rotated =
      angle === 0
        ? small.gray
        : rotateGrayscale(small.gray, small.width, small.height, angle)
    const score = verticalLineScore(rotated, small.width, small.height, gap)

    if (angle === 0) zeroScore = score
    if (score > bestScore) {
      bestScore = score
      bestAngle = angle
    }
  }

  if (bestScore < zeroScore * 1.05) return 0
  return bestAngle
}

export interface PreparedScoresheet {
  image: ImageDataLike
  angle: number
}

export function prepareScoresheet(image: ImageDataLike): PreparedScoresheet {
  const gray = toGrayscale(image)
  const angle = estimateSkewAngle(gray, image.width, image.height)

  if (Math.abs(angle) < 0.25) {
    return {
      image: { data: gray, width: image.width, height: image.height },
      angle: 0,
    }
  }

  return {
    image: {
      data: rotateGrayscale(gray, image.width, image.height, angle),
      width: image.width,
      height: image.height,
    },
    angle,
  }
}

export function detectGrid(image: ImageDataLike, options: DetectOptions = {}): GridResult {
  const lineRatio = options.lineRatio ?? 0.15
  const labelWidthRatio = options.labelWidthRatio ?? 0.62
  const insetRatio = options.insetRatio ?? 0.08

  const { width, height } = image
  const gray = toGrayscale(image)
  const threshold = otsuThreshold(gray)

  const verticalProjection = new Array<number>(width).fill(0)
  const horizontalProjection = new Array<number>(height).fill(0)

  const gapX = Math.max(2, Math.round(width * 0.004))
  for (let y = 0; y < height; y++) {
    const rowStart = y * width
    for (let x = gapX; x < width - gapX; x++) {
      const response =
        Math.min(gray[rowStart + x - gapX], gray[rowStart + x + gapX]) -
        gray[rowStart + x]
      if (response > 0) verticalProjection[x] += response
    }
  }

  const gapY = Math.max(2, Math.round(height * 0.004))
  for (let y = gapY; y < height - gapY; y++) {
    const upStart = (y - gapY) * width
    const downStart = (y + gapY) * width
    const rowStart = y * width
    for (let x = 0; x < width; x++) {
      const response =
        Math.min(gray[upStart + x], gray[downStart + x]) - gray[rowStart + x]
      if (response > 0) horizontalProjection[y] += response
    }
  }

  const verticalLines = findLines(verticalProjection, width, lineRatio)
  const horizontalCandidates = findLines(horizontalProjection, height, lineRatio)
  const horizontalLines = regularizeLines(
    horizontalCandidates,
    horizontalProjection,
    height,
  )

  if (verticalLines.length >= 2) {
    const gaps: number[] = []
    for (let i = 1; i < verticalLines.length; i++) {
      gaps.push(verticalLines[i] - verticalLines[i - 1])
    }
    gaps.sort((a, b) => a - b)
    const boundaryGap = gaps[Math.floor(gaps.length / 2)] * 0.5

    if (verticalLines[0] > boundaryGap) verticalLines.unshift(0)
    if (width - 1 - verticalLines[verticalLines.length - 1] > boundaryGap) {
      verticalLines.push(width - 1)
    }
  }

  const minColumn = Math.max(3, Math.round(width * 0.01))
  const minRow = Math.max(3, Math.round(height * 0.005))

  const columns = toIntervals(verticalLines, minColumn)
  const rows = toIntervals(horizontalLines, minRow)

  if (columns.length === 0 || rows.length === 0) {
    return {
      cells: [],
      verticalLines,
      horizontalLines,
      rows: rows.length,
      columns: 0,
      blocks: 0,
    }
  }

  const sortedWidths = columns.map((column) => column.width).sort((a, b) => a - b)
  const median = sortedWidths[Math.floor(sortedWidths.length / 2)]
  const labelThreshold = median * labelWidthRatio

  const moveColumns = columns.filter((column) => column.width >= labelThreshold)

  if (moveColumns.length === 0) {
    return {
      cells: [],
      verticalLines,
      horizontalLines,
      rows: rows.length,
      columns: 0,
      blocks: 0,
    }
  }

  const cells: GridCell[] = []
  const blocks = Math.ceil(moveColumns.length / 2)

  for (let block = 0; block < blocks; block++) {
    const pair: Array<{ interval: Interval; color: 'white' | 'black' }> = [
      { interval: moveColumns[block * 2], color: 'white' },
    ]
    const black = moveColumns[block * 2 + 1]
    if (black) pair.push({ interval: black, color: 'black' })

    for (let row = 0; row < rows.length; row++) {
      for (const { interval, color } of pair) {
        const box = insetBox(
          {
            x: interval.start,
            y: rows[row].start,
            width: interval.width,
            height: rows[row].width,
          },
          insetRatio,
          width,
          height,
        )

        cells.push({
          ...box,
          row,
          block,
          color,
          inkRatio: inkRatioIn(gray, width, box, threshold),
        })
      }
    }
  }

  return {
    cells,
    verticalLines,
    horizontalLines,
    rows: rows.length,
    columns: moveColumns.length,
    blocks,
  }
}
