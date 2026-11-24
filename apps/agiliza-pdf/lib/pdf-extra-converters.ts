import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import {
  A4_HEIGHT,
  A4_WIDTH,
  sanitizeForWinAnsi,
} from './convert-to-pdf.ts'
import { PdfOperationError, type PdfOperationOutput } from './pdf-operations.ts'
import {
  MAX_RENDER_PAGES,
  normalizePdfJsError,
  stripPdfExtension,
} from './pdf-to-media.ts'

export type CsvDelimiterOption = 'auto' | ',' | ';' | '\t'

export interface CsvToPdfOptions {
  title?: string
  delimiter?: CsvDelimiterOption
  orientation?: 'portrait' | 'landscape'
  hasHeaderRow?: boolean
}

export interface HtmlToPdfOptions {
  title?: string
  fontSize?: number
}

export type HtmlBlockType =
  | 'heading'
  | 'paragraph'
  | 'list-item'
  | 'blockquote'
  | 'code'
  | 'hr'

export interface HtmlBlock {
  type: HtmlBlockType
  level?: number
  text: string
}

export interface ExtractedMarkdownLine {
  text: string
  fontSize: number
  y: number
}

export interface ExtractedMarkdownPage {
  pageNumber: number
  lines: ExtractedMarkdownLine[]
}

export interface PdfToMarkdownResult {
  pageCount: number
  processedPages: number
  truncated: boolean
  markdown: string
  hasSelectableText: boolean
}

export function buildMarkdownFilename(originalName: string): string {
  const base = stripPdfExtension(originalName)
  return `${base}.md`
}

function wrapTextToWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const clean = text.trim()
  if (!clean) return ['']
  const words = clean.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
      current = ''
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word
    } else {
      let chunk = ''
      for (const ch of word) {
        const nextChunk = chunk + ch
        if (font.widthOfTextAtSize(nextChunk, fontSize) > maxWidth && chunk) {
          lines.push(chunk)
          chunk = ch
        } else {
          chunk = nextChunk
        }
      }
      current = chunk
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines.length > 0 ? lines : ['']
}

// ============================================================================
// CSV -> PDF
// ============================================================================

export function detectCsvDelimiter(rawCsv: string): ',' | ';' | '\t' {
  const sampleLines = rawCsv
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 5)

  const candidates: readonly (',' | ';' | '\t')[] = [';', ',', '\t']
  let bestDelimiter: ',' | ';' | '\t' = ','
  let bestScore = -1

  for (const candidate of candidates) {
    const counts = sampleLines.map((line) => {
      let count = 0
      let inQuotes = false
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]
        if (ch === '"') {
          inQuotes = !inQuotes
        } else if (ch === candidate && !inQuotes) {
          count += 1
        }
      }
      return count
    })
    const total = counts.reduce((sum, n) => sum + n, 0)
    if (total > bestScore) {
      bestScore = total
      bestDelimiter = candidate
    }
  }

  return bestScore > 0 ? bestDelimiter : ','
}

export function parseCsvTable(
  rawCsv: string,
  delimiterOption: CsvDelimiterOption = 'auto',
): string[][] {
  const normalized = rawCsv.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) {
    return []
  }

  const delimiter =
    delimiterOption === 'auto' ? detectCsvDelimiter(normalized) : delimiterOption

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]
    const next = normalized[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        currentCell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if (ch === '\n') {
      currentRow.push(currentCell.trim())
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ''
    } else {
      currentCell += ch
    }
  }

  currentRow.push(currentCell.trim())
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow)
  }

  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0)
  return rows.map((row) => {
    const padded = [...row]
    while (padded.length < maxColumns) {
      padded.push('')
    }
    return padded
  })
}

export async function convertCsvToPdf(
  rawCsv: string,
  options: CsvToPdfOptions = {},
): Promise<PdfOperationOutput> {
  const rows = parseCsvTable(rawCsv, options.delimiter ?? 'auto')
  if (rows.length === 0) {
    throw new PdfOperationError(
      'Cole ou importe um arquivo CSV com pelo menos 1 linha de dados.',
    )
  }

  const columnCount = rows[0]?.length ?? 0
  if (columnCount === 0) {
    throw new PdfOperationError('Nenhuma coluna válida foi identificada no CSV.')
  }

  const orientation =
    options.orientation ?? (columnCount >= 6 ? 'landscape' : 'portrait')
  const pageWidth = orientation === 'landscape' ? A4_HEIGHT : A4_WIDTH
  const pageHeight = orientation === 'landscape' ? A4_WIDTH : A4_HEIGHT
  const margin = 36
  const tableWidth = pageWidth - margin * 2
  const colWidth = tableWidth / columnCount
  const cellPaddingX = 5
  const cellPaddingY = 5
  const fontSize = columnCount >= 8 ? 8 : 9.5
  const lineHeight = fontSize * 1.35
  const hasHeaderRow = options.hasHeaderRow ?? true

  const doc = await PDFDocument.create()
  const regularFont = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([pageWidth, pageHeight])
  let cursorY = pageHeight - margin

  const cleanTitle = options.title ? sanitizeForWinAnsi(options.title).trim() : ''
  if (cleanTitle) {
    const titleSize = 14
    const titleLines = wrapTextToWidth(cleanTitle, boldFont, titleSize, tableWidth)
    for (const line of titleLines) {
      page.drawText(line, {
        x: margin,
        y: cursorY - titleSize,
        size: titleSize,
        font: boldFont,
        color: rgb(0.06, 0.09, 0.16),
      })
      cursorY -= titleSize * 1.35
    }
    cursorY -= 10
  }

  const headerRow = hasHeaderRow ? rows[0] : null
  const bodyRows = hasHeaderRow ? rows.slice(1) : rows

  const drawRow = (
    cells: readonly string[],
    isHeader: boolean,
    rowIndex: number,
  ) => {
    const font = isHeader ? boldFont : regularFont
    const maxTextWidth = Math.max(20, colWidth - cellPaddingX * 2)
    const wrappedCells = cells.map((cell) =>
      wrapTextToWidth(sanitizeForWinAnsi(cell), font, fontSize, maxTextWidth),
    )
    const maxLines = wrappedCells.reduce(
      (max, lines) => Math.max(max, lines.length),
      1,
    )
    const rowHeight = maxLines * lineHeight + cellPaddingY * 2

    if (cursorY - rowHeight < margin) {
      page = doc.addPage([pageWidth, pageHeight])
      cursorY = pageHeight - margin
      if (headerRow && !isHeader) {
        drawRow(headerRow, true, -1)
      }
    }

    const rowBottom = cursorY - rowHeight

    if (isHeader) {
      page.drawRectangle({
        x: margin,
        y: rowBottom,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.12, 0.18, 0.28),
      })
    } else if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: rowBottom,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.95, 0.97, 0.99),
      })
    }

    page.drawRectangle({
      x: margin,
      y: rowBottom,
      width: tableWidth,
      height: rowHeight,
      borderColor: rgb(0.8, 0.84, 0.9),
      borderWidth: 0.6,
    })

    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
      const cellX = margin + colIndex * colWidth
      if (colIndex > 0) {
        page.drawLine({
          start: { x: cellX, y: cursorY },
          end: { x: cellX, y: rowBottom },
          thickness: 0.5,
          color: rgb(0.8, 0.84, 0.9),
        })
      }

      const cellLines = wrappedCells[colIndex] ?? ['']
      cellLines.forEach((line, lineIdx) => {
        if (!line) return
        page.drawText(line, {
          x: cellX + cellPaddingX,
          y: cursorY - cellPaddingY - fontSize - lineIdx * lineHeight,
          size: fontSize,
          font,
          color: isHeader ? rgb(1, 1, 1) : rgb(0.1, 0.14, 0.22),
        })
      })
    }

    cursorY = rowBottom
  }

  if (headerRow) {
    drawRow(headerRow, true, -1)
  }
  bodyRows.forEach((row, index) => {
    drawRow(row, false, index)
  })

  const bytes = await doc.save()
  return {
    bytes,
    pageCount: doc.getPageCount(),
  }
}

// ============================================================================
// HTML -> PDF
// ============================================================================

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aacute: 'á',
  Aacute: 'Á',
  agrave: 'à',
  Agrave: 'À',
  acirc: 'â',
  Acirc: 'Â',
  atilde: 'ã',
  Atilde: 'Ã',
  eacute: 'é',
  Eacute: 'É',
  ecirc: 'ê',
  Ecirc: 'Ê',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  ocirc: 'ô',
  Ocirc: 'Ô',
  otilde: 'õ',
  Otilde: 'Õ',
  uacute: 'ú',
  Uacute: 'Ú',
  ccedil: 'ç',
  Ccedil: 'Ç',
  copy: '(c)',
  reg: '(R)',
  mdash: '-',
  ndash: '-',
  hellip: '...',
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    })
    .replace(/&([a-zA-Z]+);/g, (full, name: string) => HTML_ENTITY_MAP[name] ?? full)
}

function stripTagsAndCollapse(htmlFragment: string): string {
  const withoutTags = htmlFragment
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decodeHtmlEntities(withoutTags)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim()
}

export function parseHtmlToBlocks(rawHtml: string): HtmlBlock[] {
  const cleaned = rawHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .trim()

  if (!cleaned) return []

  const blocks: HtmlBlock[] = []
  const blockRegex =
    /<(h[1-6]|p|li|blockquote|pre|tr)\b[^>]*>([\s\S]*?)<\/\1>|<hr\b[^>]*\/?>/gi

  let match: RegExpExecArray | null
  let matchedAny = false

  while ((match = blockRegex.exec(cleaned)) !== null) {
    matchedAny = true
    const full = match[0]
    const tag = match[1]?.toLowerCase()
    const inner = match[2] ?? ''

    if (!tag && /^<hr/i.test(full)) {
      blocks.push({ type: 'hr', text: '' })
      continue
    }

    if (tag === 'pre') {
      const codeText = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '')).trim()
      if (codeText) {
        blocks.push({ type: 'code', text: codeText })
      }
      continue
    }

    if (tag === 'tr') {
      const cells: string[] = []
      const cellRegex = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi
      let cellMatch: RegExpExecArray | null
      while ((cellMatch = cellRegex.exec(inner)) !== null) {
        const cellText = stripTagsAndCollapse(cellMatch[2] ?? '')
        if (cellText) cells.push(cellText)
      }
      if (cells.length > 0) {
        blocks.push({ type: 'paragraph', text: cells.join(' | ') })
      }
      continue
    }

    const text = stripTagsAndCollapse(inner)
    if (!text) continue

    if (tag && /^h[1-6]$/.test(tag)) {
      blocks.push({
        type: 'heading',
        level: Number.parseInt(tag.slice(1), 10),
        text,
      })
    } else if (tag === 'li') {
      blocks.push({ type: 'list-item', text })
    } else if (tag === 'blockquote') {
      blocks.push({ type: 'blockquote', text })
    } else {
      blocks.push({ type: 'paragraph', text })
    }
  }

  if (!matchedAny) {
    const fallbackText = stripTagsAndCollapse(cleaned)
    if (fallbackText) {
      for (const line of fallbackText.split('\n')) {
        const trimmed = line.trim()
        if (trimmed) {
          blocks.push({ type: 'paragraph', text: trimmed })
        }
      }
    }
  }

  return blocks
}

export async function convertHtmlToPdf(
  rawHtml: string,
  options: HtmlToPdfOptions = {},
): Promise<PdfOperationOutput> {
  const blocks = parseHtmlToBlocks(rawHtml)
  if (blocks.length === 0) {
    throw new PdfOperationError(
      'Cole ou importe um código HTML com conteúdo visível antes de gerar o PDF.',
    )
  }

  const baseFontSize = Math.min(18, Math.max(9, Math.round(options.fontSize ?? 11)))
  const margin = 48
  const maxWidth = A4_WIDTH - margin * 2

  const doc = await PDFDocument.create()
  const regularFont = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  const monoFont = await doc.embedFont(StandardFonts.Courier)

  let page = doc.addPage([A4_WIDTH, A4_HEIGHT])
  let cursorY = A4_HEIGHT - margin

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < margin) {
      page = doc.addPage([A4_WIDTH, A4_HEIGHT])
      cursorY = A4_HEIGHT - margin
    }
  }

  const cleanTitle = options.title ? sanitizeForWinAnsi(options.title).trim() : ''
  if (cleanTitle) {
    const titleSize = baseFontSize + 7
    const lines = wrapTextToWidth(cleanTitle, boldFont, titleSize, maxWidth)
    for (const line of lines) {
      ensureSpace(titleSize * 1.4)
      page.drawText(line, {
        x: margin,
        y: cursorY - titleSize,
        size: titleSize,
        font: boldFont,
        color: rgb(0.06, 0.09, 0.16),
      })
      cursorY -= titleSize * 1.35
    }
    cursorY -= 12
  }

  for (const block of blocks) {
    if (block.type === 'hr') {
      ensureSpace(16)
      cursorY -= 6
      page.drawLine({
        start: { x: margin, y: cursorY },
        end: { x: A4_WIDTH - margin, y: cursorY },
        thickness: 0.8,
        color: rgb(0.78, 0.82, 0.88),
      })
      cursorY -= 12
      continue
    }

    const sanitized = sanitizeForWinAnsi(block.text)
    if (!sanitized.trim()) continue

    if (block.type === 'heading') {
      const level = block.level ?? 2
      const headingSize =
        level === 1
          ? baseFontSize + 7
          : level === 2
            ? baseFontSize + 4
            : baseFontSize + 2
      const lineHeight = headingSize * 1.35
      cursorY -= 4
      const lines = wrapTextToWidth(sanitized, boldFont, headingSize, maxWidth)
      for (const line of lines) {
        ensureSpace(lineHeight)
        page.drawText(line, {
          x: margin,
          y: cursorY - headingSize,
          size: headingSize,
          font: boldFont,
          color: rgb(0.06, 0.09, 0.16),
        })
        cursorY -= lineHeight
      }
      cursorY -= 6
      continue
    }

    if (block.type === 'code') {
      const codeSize = Math.max(8.5, baseFontSize - 1.5)
      const lineHeight = codeSize * 1.4
      const rawLines = sanitized.split('\n')
      const wrapped: string[] = []
      for (const rawLine of rawLines) {
        wrapped.push(
          ...wrapTextToWidth(rawLine, monoFont, codeSize, maxWidth - 16),
        )
      }
      const boxHeight = wrapped.length * lineHeight + 12
      ensureSpace(Math.min(boxHeight, A4_HEIGHT - margin * 2))

      for (const line of wrapped) {
        ensureSpace(lineHeight + 4)
        page.drawRectangle({
          x: margin,
          y: cursorY - lineHeight - 2,
          width: maxWidth,
          height: lineHeight + 2,
          color: rgb(0.95, 0.96, 0.98),
        })
        if (line) {
          page.drawText(line, {
            x: margin + 8,
            y: cursorY - codeSize - 2,
            size: codeSize,
            font: monoFont,
            color: rgb(0.12, 0.16, 0.24),
          })
        }
        cursorY -= lineHeight
      }
      cursorY -= 8
      continue
    }

    const lineHeight = baseFontSize * 1.45
    const indent =
      block.type === 'list-item' || block.type === 'blockquote' ? 16 : 0
    const prefix = block.type === 'list-item' ? '- ' : ''
    const lines = wrapTextToWidth(
      `${prefix}${sanitized}`,
      regularFont,
      baseFontSize,
      maxWidth - indent,
    )

    for (const line of lines) {
      ensureSpace(lineHeight)
      if (block.type === 'blockquote') {
        page.drawLine({
          start: { x: margin + 4, y: cursorY },
          end: { x: margin + 4, y: cursorY - lineHeight + 2 },
          thickness: 2,
          color: rgb(0.24, 0.51, 0.96),
        })
      }
      if (line) {
        page.drawText(line, {
          x: margin + indent,
          y: cursorY - baseFontSize,
          size: baseFontSize,
          font: regularFont,
          color:
            block.type === 'blockquote'
              ? rgb(0.26, 0.32, 0.42)
              : rgb(0.1, 0.13, 0.2),
        })
      }
      cursorY -= lineHeight
    }

    cursorY -= block.type === 'list-item' ? 3 : 7
  }

  const bytes = await doc.save()
  return {
    bytes,
    pageCount: doc.getPageCount(),
  }
}

// ============================================================================
// PDF -> Markdown
// ============================================================================

function computeMedian(values: readonly number[]): number {
  if (values.length === 0) return 12
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted[mid] ?? 12
}

export function formatPagesAsMarkdown(
  pages: readonly ExtractedMarkdownPage[],
  options: { includePageHeaders?: boolean } = {},
): { markdown: string; hasSelectableText: boolean } {
  const includePageHeaders = options.includePageHeaders ?? true
  const allFontSizes: number[] = []

  for (const page of pages) {
    for (const line of page.lines) {
      if (line.text.trim() && line.fontSize > 0) {
        allFontSizes.push(line.fontSize)
      }
    }
  }

  if (allFontSizes.length === 0) {
    return { markdown: '', hasSelectableText: false }
  }

  const medianFontSize = computeMedian(allFontSizes)
  const sections: string[] = []

  for (const page of pages) {
    const cleanLines = page.lines
      .map((line) => ({
        ...line,
        text: line.text.replace(/\s+/g, ' ').trim(),
      }))
      .filter((line) => line.text.length > 0)

    if (cleanLines.length === 0) continue

    const mdLines: string[] = []
    if (includePageHeaders) {
      mdLines.push(`<!-- Página ${page.pageNumber} -->`)
    }

    for (const line of cleanLines) {
      const text = line.text
      const isBullet = /^[•▪◦*-]\s+/.test(text)
      const isNumbered = /^\d+[.)]\s+/.test(text)

      if (isBullet) {
        mdLines.push(`- ${text.replace(/^[•▪◦*-]\s+/, '')}`)
      } else if (isNumbered) {
        mdLines.push(text.replace(/^(\d+)[)]\s+/, '$1. '))
      } else if (
        line.fontSize >= medianFontSize * 1.45 &&
        text.length <= 120
      ) {
        mdLines.push(`# ${text}`)
      } else if (
        line.fontSize >= medianFontSize * 1.2 &&
        text.length <= 120
      ) {
        mdLines.push(`## ${text}`)
      } else {
        mdLines.push(text)
      }
    }

    sections.push(mdLines.join('\n\n'))
  }

  return {
    markdown: sections.join('\n\n---\n\n'),
    hasSelectableText: sections.length > 0,
  }
}

export async function extractMarkdownFromPdfBytes(
  bytes: Uint8Array,
  options: { maxPages?: number; includePageHeaders?: boolean } = {},
): Promise<PdfToMarkdownResult> {
  const maxPages = options.maxPages ?? MAX_RENDER_PAGES

  try {
    const pdfjs = await import('pdfjs-dist')
    if (pdfjs.GlobalWorkerOptions.workerSrc !== '/pdf.worker.min.mjs') {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    }

    const loadingTask = pdfjs.getDocument({ data: bytes.slice() })
    const pdf = await loadingTask.promise

    try {
      const pageCount = pdf.numPages
      const processedPages = Math.min(pageCount, maxPages)
      const pages: ExtractedMarkdownPage[] = []

      for (let pageNumber = 1; pageNumber <= processedPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()

        const lineBuckets: {
          y: number
          items: { x: number; text: string; fontSize: number }[]
        }[] = []

        for (const item of textContent.items) {
          if (!('str' in item) || !item.str.trim()) continue
          const transform = item.transform as number[]
          const x = transform[4] ?? 0
          const y = transform[5] ?? 0
          const fontSize = Math.hypot(transform[0] ?? 0, transform[1] ?? 0) || 12

          const existingBucket = lineBuckets.find(
            (bucket) => Math.abs(bucket.y - y) <= Math.max(3, fontSize * 0.45),
          )
          if (existingBucket) {
            existingBucket.items.push({ x, text: item.str, fontSize })
          } else {
            lineBuckets.push({
              y,
              items: [{ x, text: item.str, fontSize }],
            })
          }
        }

        // Ordena de cima para baixo (Y decrescente no PDF) e esquerda para direita
        lineBuckets.sort((a, b) => b.y - a.y)
        const lines: ExtractedMarkdownLine[] = lineBuckets.map((bucket) => {
          bucket.items.sort((a, b) => a.x - b.x)
          const text = bucket.items.map((it) => it.text).join(' ').trim()
          const maxFont = bucket.items.reduce(
            (max, it) => Math.max(max, it.fontSize),
            12,
          )
          return {
            text,
            fontSize: maxFont,
            y: bucket.y,
          }
        })

        pages.push({ pageNumber, lines })
      }

      const formatted = formatPagesAsMarkdown(pages, {
        includePageHeaders: options.includePageHeaders ?? true,
      })

      return {
        pageCount,
        processedPages,
        truncated: pageCount > maxPages,
        markdown: formatted.markdown,
        hasSelectableText: formatted.hasSelectableText,
      }
    } finally {
      await loadingTask.destroy()
    }
  } catch (error) {
    throw normalizePdfJsError(error)
  }
}
