import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { PdfOperationError, type PdfOperationOutput } from './pdf-operations.ts'

export type PageOrientation = 'auto' | 'portrait' | 'landscape'
export type PageMarginPreset = 'none' | 'small' | 'standard'
export type EmbeddableImageFormat = 'png' | 'jpg'

export interface EmbeddableImageInput {
  name: string
  format: EmbeddableImageFormat
  bytes: Uint8Array
}

export interface ImagesToPdfOptions {
  orientation?: PageOrientation
  margin?: PageMarginPreset
}

export interface TextToPdfOptions {
  title?: string
  fontSize?: number
  margin?: PageMarginPreset
}

// A4 em pontos PDF (72 DPI)
export const A4_WIDTH = 595.28
export const A4_HEIGHT = 841.89

const MARGIN_POINTS: Record<PageMarginPreset, number> = {
  none: 0,
  small: 24,
  standard: 48,
}

/**
 * Normaliza caracteres tipográficos e substitui glifos fora de WinAnsi
 * para evitar falhas de codificação ao renderizar com fontes padrão do PDF.
 */
export function sanitizeForWinAnsi(input: string): string {
  const normalized = input
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')

  let output = ''
  for (const char of normalized) {
    const code = char.codePointAt(0) ?? 0
    if (code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      output += char
    } else if (code === 0x20ac) {
      output += 'EUR'
    } else if (code === 0x2022) {
      output += '-'
    } else {
      output += ' '
    }
  }
  return output
}

export function calculateFittedImageRect(
  imgWidth: number,
  imgHeight: number,
  pageWidth: number,
  pageHeight: number,
  margin: number,
): { x: number; y: number; width: number; height: number } {
  const availWidth = Math.max(1, pageWidth - margin * 2)
  const availHeight = Math.max(1, pageHeight - margin * 2)
  const scale = Math.min(availWidth / imgWidth, availHeight / imgHeight)
  const width = imgWidth * scale
  const height = imgHeight * scale
  const x = (pageWidth - width) / 2
  const y = (pageHeight - height) / 2
  return { x, y, width, height }
}

export async function convertImagesToPdf(
  images: readonly EmbeddableImageInput[],
  options: ImagesToPdfOptions = {},
): Promise<PdfOperationOutput> {
  if (images.length === 0) {
    throw new PdfOperationError(
      'Selecione pelo menos 1 imagem para converter em PDF.',
    )
  }

  const orientation = options.orientation ?? 'auto'
  const margin = MARGIN_POINTS[options.margin ?? 'small']
  const doc = await PDFDocument.create()

  for (const item of images) {
    let embedded
    try {
      embedded =
        item.format === 'png'
          ? await doc.embedPng(item.bytes)
          : await doc.embedJpg(item.bytes)
    } catch {
      throw new PdfOperationError(
        `Não foi possível ler a imagem "${item.name}". Verifique se o arquivo não está corrompido.`,
      )
    }

    const isLandscape =
      orientation === 'landscape' ||
      (orientation === 'auto' && embedded.width > embedded.height)

    const pageWidth = isLandscape ? A4_HEIGHT : A4_WIDTH
    const pageHeight = isLandscape ? A4_WIDTH : A4_HEIGHT

    const page = doc.addPage([pageWidth, pageHeight])
    const rect = calculateFittedImageRect(
      embedded.width,
      embedded.height,
      pageWidth,
      pageHeight,
      margin,
    )

    page.drawImage(embedded, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })
  }

  const bytes = await doc.save()
  return {
    bytes,
    pageCount: doc.getPageCount(),
  }
}

function wrapLine(line: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!line.trim()) return ['']
  const words = line.split(/\s+/)
  const wrapped: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) {
      wrapped.push(current)
      current = ''
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word
    } else {
      // Quebra palavra muito longa caractere por caractere
      let chunk = ''
      for (const ch of word) {
        const nextChunk = chunk + ch
        if (font.widthOfTextAtSize(nextChunk, fontSize) > maxWidth && chunk) {
          wrapped.push(chunk)
          chunk = ch
        } else {
          chunk = nextChunk
        }
      }
      current = chunk
    }
  }

  if (current) {
    wrapped.push(current)
  }

  return wrapped
}

export async function convertTextToPdf(
  rawText: string,
  options: TextToPdfOptions = {},
): Promise<PdfOperationOutput> {
  const sanitizedBody = sanitizeForWinAnsi(rawText).trim()
  if (!sanitizedBody) {
    throw new PdfOperationError(
      'Digite ou importe algum texto antes de gerar o PDF.',
    )
  }

  const fontSize = Math.min(20, Math.max(8, Math.round(options.fontSize ?? 11)))
  const margin = MARGIN_POINTS[options.margin ?? 'standard'] || 36
  const lineHeight = fontSize * 1.45

  const doc = await PDFDocument.create()
  const regularFont = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  const maxWidth = A4_WIDTH - margin * 2
  let page = doc.addPage([A4_WIDTH, A4_HEIGHT])
  let cursorY = A4_HEIGHT - margin

  const cleanTitle = options.title ? sanitizeForWinAnsi(options.title).trim() : ''
  if (cleanTitle) {
    const titleSize = fontSize + 5
    const titleLines = wrapLine(cleanTitle, boldFont, titleSize, maxWidth)
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

  const paragraphs = sanitizedBody.split('\n')
  for (const paragraph of paragraphs) {
    const lines = wrapLine(paragraph, regularFont, fontSize, maxWidth)
    for (const line of lines) {
      if (cursorY - lineHeight < margin) {
        page = doc.addPage([A4_WIDTH, A4_HEIGHT])
        cursorY = A4_HEIGHT - margin
      }

      if (line) {
        page.drawText(line, {
          x: margin,
          y: cursorY - fontSize,
          size: fontSize,
          font: regularFont,
          color: rgb(0.08, 0.11, 0.18),
        })
      }

      cursorY -= lineHeight
    }
  }

  const bytes = await doc.save()
  return {
    bytes,
    pageCount: doc.getPageCount(),
  }
}
