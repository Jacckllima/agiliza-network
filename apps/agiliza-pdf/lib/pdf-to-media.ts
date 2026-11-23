import { PdfOperationError } from './pdf-operations.ts'

export type ExportImageFormat = 'png' | 'jpg'
export type RenderScale = 1 | 1.5 | 2

export const MAX_RENDER_PAGES = 50
export const THUMBNAILS_PER_BATCH = 6

export interface ExtractedPageText {
  pageNumber: number
  text: string
}

export interface TextExtractionResult {
  pageCount: number
  processedPages: number
  truncated: boolean
  pages: ExtractedPageText[]
  combinedText: string
  hasSelectableText: boolean
}

export interface RenderedPageImage {
  pageNumber: number
  dataUrl: string
  width: number
  height: number
}

export function stripPdfExtension(filename: string): string {
  const trimmed = filename.trim()
  if (!trimmed) return 'documento'
  return trimmed.replace(/\.pdf$/i, '') || 'documento'
}

export function buildPageImageFilename(
  originalName: string,
  pageNumber: number,
  format: ExportImageFormat,
): string {
  const base = stripPdfExtension(originalName)
  return `${base}-pagina-${pageNumber}.${format}`
}

export function buildExtractedTextFilename(originalName: string): string {
  const base = stripPdfExtension(originalName)
  return `${base}-texto.txt`
}

export function formatExtractedPagesText(
  pages: readonly ExtractedPageText[],
): {
  combinedText: string
  hasSelectableText: boolean
  nonEmptyPages: number
} {
  let nonEmptyPages = 0
  const blocks: string[] = []

  for (const page of pages) {
    const cleaned = page.text.replace(/\s+/g, ' ').trim()
    if (cleaned.length > 0) {
      nonEmptyPages += 1
      blocks.push(`=== Página ${page.pageNumber} ===\n${cleaned}`)
    }
  }

  return {
    combinedText: blocks.join('\n\n'),
    hasSelectableText: nonEmptyPages > 0,
    nonEmptyPages,
  }
}

export function getRenderablePageWindow(
  totalPages: number,
  batchIndex: number,
  batchSize = THUMBNAILS_PER_BATCH,
): {
  pages: number[]
  maxAllowedPages: number
  totalBatches: number
  isTruncated: boolean
} {
  const safeTotal = Math.max(0, Math.floor(totalPages))
  const maxAllowedPages = Math.min(safeTotal, MAX_RENDER_PAGES)
  const isTruncated = safeTotal > MAX_RENDER_PAGES

  if (maxAllowedPages === 0) {
    return {
      pages: [],
      maxAllowedPages: 0,
      totalBatches: 0,
      isTruncated: false,
    }
  }

  const totalBatches = Math.ceil(maxAllowedPages / batchSize)
  const clampedBatch = Math.min(Math.max(0, batchIndex), totalBatches - 1)
  const startPage = clampedBatch * batchSize + 1
  const endPage = Math.min(startPage + batchSize - 1, maxAllowedPages)

  const pages: number[] = []
  for (let page = startPage; page <= endPage; page += 1) {
    pages.push(page)
  }

  return {
    pages,
    maxAllowedPages,
    totalBatches,
    isTruncated,
  }
}

export function normalizePdfJsError(error: unknown): PdfOperationError {
  if (error instanceof PdfOperationError) {
    return error
  }
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name: unknown }).name)
      : ''
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  if (
    name === 'PasswordException' ||
    message.includes('password') ||
    message.includes('encrypted')
  ) {
    return new PdfOperationError(
      'Este PDF está protegido por senha e não pode ser convertido nesta etapa.',
    )
  }

  if (
    name === 'InvalidPDFException' ||
    message.includes('invalid pdf') ||
    message.includes('corrupt')
  ) {
    return new PdfOperationError(
      'Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.',
    )
  }

  return new PdfOperationError(
    'Falha ao processar o PDF no navegador. Tente novamente com outro arquivo.',
  )
}

async function loadPdfJsLib() {
  const pdfjs = await import('pdfjs-dist')
  if (pdfjs.GlobalWorkerOptions.workerSrc !== '/pdf.worker.min.mjs') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  }
  return pdfjs
}

export async function renderPdfPageToImage(
  bytes: Uint8Array,
  pageNumber: number,
  options: {
    format: ExportImageFormat
    scale: RenderScale
    jpgQuality?: number
  },
): Promise<RenderedPageImage> {
  try {
    const pdfjs = await loadPdfJsLib()
    const loadingTask = pdfjs.getDocument({ data: bytes.slice() })
    const pdf = await loadingTask.promise

    try {
      if (pageNumber < 1 || pageNumber > pdf.numPages) {
        throw new PdfOperationError(
          `Página ${pageNumber} fora do intervalo do documento (1 a ${pdf.numPages}).`,
        )
      }

      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: options.scale })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new PdfOperationError(
          'Seu navegador não disponibilizou contexto 2D para renderizar a página.',
        )
      }

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)

      if (options.format === 'jpg') {
        context.fillStyle = '#FFFFFF'
        context.fillRect(0, 0, canvas.width, canvas.height)
      }

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise

      const mimeType = options.format === 'jpg' ? 'image/jpeg' : 'image/png'
      const dataUrl =
        options.format === 'jpg'
          ? canvas.toDataURL(mimeType, options.jpgQuality ?? 0.9)
          : canvas.toDataURL(mimeType)

      return {
        pageNumber,
        dataUrl,
        width: canvas.width,
        height: canvas.height,
      }
    } finally {
      await loadingTask.destroy()
    }
  } catch (error) {
    throw normalizePdfJsError(error)
  }
}

export async function renderPdfBatchThumbnails(
  bytes: Uint8Array,
  pageNumbers: readonly number[],
  scale = 0.65,
): Promise<RenderedPageImage[]> {
  try {
    const pdfjs = await loadPdfJsLib()
    const loadingTask = pdfjs.getDocument({ data: bytes.slice() })
    const pdf = await loadingTask.promise

    try {
      const rendered: RenderedPageImage[] = []
      for (const pageNumber of pageNumbers) {
        if (pageNumber < 1 || pageNumber > pdf.numPages) continue
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) continue

        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        context.fillStyle = '#FFFFFF'
        context.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise

        rendered.push({
          pageNumber,
          dataUrl: canvas.toDataURL('image/jpeg', 0.8),
          width: canvas.width,
          height: canvas.height,
        })
      }
      return rendered
    } finally {
      await loadingTask.destroy()
    }
  } catch (error) {
    throw normalizePdfJsError(error)
  }
}

export async function extractTextFromPdfBytes(
  bytes: Uint8Array,
  maxPages = MAX_RENDER_PAGES,
): Promise<TextExtractionResult> {
  try {
    const pdfjs = await loadPdfJsLib()
    const loadingTask = pdfjs.getDocument({ data: bytes.slice() })
    const pdf = await loadingTask.promise

    try {
      const pageCount = pdf.numPages
      const processedPages = Math.min(pageCount, maxPages)
      const pages: ExtractedPageText[] = []

      for (let pageNumber = 1; pageNumber <= processedPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const text = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
        pages.push({ pageNumber, text })
      }

      const formatted = formatExtractedPagesText(pages)
      return {
        pageCount,
        processedPages,
        truncated: pageCount > maxPages,
        pages,
        combinedText: formatted.combinedText,
        hasSelectableText: formatted.hasSelectableText,
      }
    } finally {
      await loadingTask.destroy()
    }
  } catch (error) {
    throw normalizePdfJsError(error)
  }
}
