import { parsePageRange, PdfOperationError } from './pdf-operations.ts'
import {
  renderPdfPageToImage,
  stripPdfExtension,
} from './pdf-to-media.ts'

export type OcrLanguage = 'por' | 'eng' | 'por+eng'

export const MAX_OCR_PAGES = 10

export interface OcrProgressUpdate {
  pageNumber: number
  currentIndex: number
  totalPages: number
  stage: 'loading-engine' | 'rendering' | 'recognizing'
  progress: number
}

export interface OcrPageResult {
  pageNumber: number
  text: string
  confidence: number
}

export interface OcrPdfResult {
  pages: OcrPageResult[]
  combinedText: string
  averageConfidence: number
  processedPages: number
}

export interface OcrRunOptions {
  language?: OcrLanguage
  pageRangeExpression?: string
  totalPages: number
  onProgress?: (update: OcrProgressUpdate) => void
  signal?: AbortSignal
}

export function buildOcrTextFilename(originalName: string): string {
  const base = stripPdfExtension(originalName)
  return `${base}-ocr.txt`
}

export function parseOcrPageSelection(
  expression: string,
  totalPages: number,
  maxPages = MAX_OCR_PAGES,
): number[] {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new PdfOperationError('O PDF precisa ter pelo menos 1 página para OCR.')
  }

  const trimmed = expression.trim()
  if (!trimmed) {
    const limit = Math.min(totalPages, maxPages)
    return Array.from({ length: limit }, (_, idx) => idx + 1)
  }

  const pages = parsePageRange(trimmed, totalPages)
  if (pages.length > maxPages) {
    throw new PdfOperationError(
      `O OCR local no navegador é limitado a ${maxPages} páginas por operação para evitar travamentos. Selecione um intervalo menor (ex.: 1-${maxPages}).`,
    )
  }

  return pages
}

export function formatOcrPagesResult(pages: readonly OcrPageResult[]): {
  combinedText: string
  averageConfidence: number
} {
  if (pages.length === 0) {
    return { combinedText: '', averageConfidence: 0 }
  }

  const blocks: string[] = []
  let confidenceSum = 0

  for (const page of pages) {
    const cleaned = page.text.replace(/\r\n?/g, '\n').trim()
    confidenceSum += Number.isFinite(page.confidence) ? page.confidence : 0
    blocks.push(
      `=== Página ${page.pageNumber} (OCR) ===\n${cleaned || '(Nenhum texto reconhecido nesta página)'}`,
    )
  }

  return {
    combinedText: blocks.join('\n\n'),
    averageConfidence: Math.round(confidenceSum / pages.length),
  }
}

export async function runOcrOnPdfBytes(
  bytes: Uint8Array,
  options: OcrRunOptions,
): Promise<OcrPdfResult> {
  const language: OcrLanguage = options.language ?? 'por'
  const selectedPages = parseOcrPageSelection(
    options.pageRangeExpression ?? '',
    options.totalPages,
  )

  if (options.signal?.aborted) {
    throw new PdfOperationError('Operação de OCR cancelada pelo usuário.')
  }

  options.onProgress?.({
    pageNumber: selectedPages[0] ?? 1,
    currentIndex: 0,
    totalPages: selectedPages.length,
    stage: 'loading-engine',
    progress: 0,
  })

  // Carregamento sob demanda para não aumentar o bundle inicial das demais abas
  const { createWorker } = await import('tesseract.js')

  let activePageNumber = selectedPages[0] ?? 1
  let activeIndex = 0

  const worker = await createWorker(language, undefined, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        options.onProgress?.({
          pageNumber: activePageNumber,
          currentIndex: activeIndex,
          totalPages: selectedPages.length,
          stage: 'recognizing',
          progress: Math.round((message.progress ?? 0) * 100),
        })
      }
    },
  })

  const results: OcrPageResult[] = []

  try {
    for (let i = 0; i < selectedPages.length; i += 1) {
      if (options.signal?.aborted) {
        throw new PdfOperationError('Operação de OCR cancelada pelo usuário.')
      }

      const pageNumber = selectedPages[i]
      if (pageNumber === undefined) continue
      activePageNumber = pageNumber
      activeIndex = i

      options.onProgress?.({
        pageNumber,
        currentIndex: i,
        totalPages: selectedPages.length,
        stage: 'rendering',
        progress: 0,
      })

      const rendered = await renderPdfPageToImage(bytes, pageNumber, {
        format: 'png',
        scale: 2,
      })

      if (options.signal?.aborted) {
        throw new PdfOperationError('Operação de OCR cancelada pelo usuário.')
      }

      const recognition = await worker.recognize(rendered.dataUrl)
      results.push({
        pageNumber,
        text: recognition.data.text ?? '',
        confidence: recognition.data.confidence ?? 0,
      })
    }
  } finally {
    await worker.terminate()
  }

  const formatted = formatOcrPagesResult(results)
  return {
    pages: results,
    combinedText: formatted.combinedText,
    averageConfidence: formatted.averageConfidence,
    processedPages: results.length,
  }
}
