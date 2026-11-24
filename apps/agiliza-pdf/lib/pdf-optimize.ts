import { PDFDocument } from 'pdf-lib'
import { PdfOperationError } from './pdf-operations.ts'
import {
  MAX_RENDER_PAGES,
  renderPdfPageToImage,
  type RenderScale,
} from './pdf-to-media.ts'

export type VisualCompressionQuality = 'low' | 'medium' | 'high'

export interface VisualQualityConfig {
  scale: RenderScale
  jpgQuality: number
  label: string
}

export const VISUAL_QUALITY_PRESETS: Record<
  VisualCompressionQuality,
  VisualQualityConfig
> = {
  low: {
    scale: 1,
    jpgQuality: 0.45,
    label: 'Baixa (menor arquivo)',
  },
  medium: {
    scale: 1.5,
    jpgQuality: 0.65,
    label: 'Média (equilibrada)',
  },
  high: {
    scale: 2,
    jpgQuality: 0.82,
    label: 'Alta (melhor nitidez)',
  },
}

export interface OptimizationStats {
  originalBytes: number
  optimizedBytes: number
  savedBytes: number
  savedPercent: number
  reduced: boolean
}

export interface PdfOptimizationResult {
  bytes: Uint8Array
  pageCount: number
  stats: OptimizationStats
  mode: 'structural' | 'visual'
}

export interface StructuralOptimizeOptions {
  stripMetadata?: boolean
}

export interface VisualCompressOptions {
  quality?: VisualCompressionQuality
  onProgress?: (currentPage: number, totalPages: number) => void
}

export interface RasterizedPageInput {
  width: number
  height: number
  jpegBytes: Uint8Array
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5) return false
  const headerSlice = bytes.subarray(0, Math.min(bytes.byteLength, 1024))
  const text = new TextDecoder('latin1').decode(headerSlice)
  return text.includes('%PDF-')
}

async function loadUnencryptedPdf(bytes: Uint8Array): Promise<PDFDocument> {
  if (!hasPdfHeader(bytes)) {
    throw new PdfOperationError(
      'O arquivo selecionado não parece ser um PDF válido.',
    )
  }

  try {
    return await PDFDocument.load(bytes)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('encrypted') || message.includes('password')) {
      throw new PdfOperationError(
        'Este PDF está protegido por senha. Desbloqueie o documento na aba Segurança e OCR antes de otimizar.',
      )
    }
    throw new PdfOperationError(
      'Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.',
    )
  }
}

export function calculateOptimizationStats(
  originalBytes: number,
  optimizedBytes: number,
): OptimizationStats {
  const safeOriginal = Math.max(0, Math.floor(originalBytes))
  const safeOptimized = Math.max(0, Math.floor(optimizedBytes))
  const savedBytes = safeOriginal - safeOptimized
  const reduced = safeOriginal > 0 && safeOptimized < safeOriginal
  const savedPercent = reduced
    ? Math.round((savedBytes / safeOriginal) * 1000) / 10
    : 0

  return {
    originalBytes: safeOriginal,
    optimizedBytes: safeOptimized,
    savedBytes,
    savedPercent,
    reduced,
  }
}

/**
 * Regrava o PDF em um documento limpo com object streams habilitados,
 * removendo objetos órfãos e metadados redundantes sem perder texto selecionável.
 */
export async function optimizePdfStructurally(
  bytes: Uint8Array,
  options: StructuralOptimizeOptions = {},
): Promise<PdfOptimizationResult> {
  const sourceDoc = await loadUnencryptedPdf(bytes)
  const cleanDoc = await PDFDocument.create()

  const indices = sourceDoc.getPageIndices()
  const copiedPages = await cleanDoc.copyPages(sourceDoc, indices)
  for (const page of copiedPages) {
    cleanDoc.addPage(page)
  }

  const stripMetadata = options.stripMetadata ?? true
  if (!stripMetadata) {
    const title = sourceDoc.getTitle()
    if (title) cleanDoc.setTitle(title)
    const author = sourceDoc.getAuthor()
    if (author) cleanDoc.setAuthor(author)
    const subject = sourceDoc.getSubject()
    if (subject) cleanDoc.setSubject(subject)
  } else {
    cleanDoc.setTitle('')
    cleanDoc.setAuthor('')
    cleanDoc.setSubject('')
    cleanDoc.setKeywords([])
    cleanDoc.setProducer('')
    cleanDoc.setCreator('')
  }

  const savedBytes = await cleanDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  })

  return {
    bytes: savedBytes,
    pageCount: cleanDoc.getPageCount(),
    stats: calculateOptimizationStats(bytes.byteLength, savedBytes.byteLength),
    mode: 'structural',
  }
}

export async function buildVisualCompressedPdfFromJpegs(
  pages: readonly RasterizedPageInput[],
  originalBytesLength: number,
): Promise<PdfOptimizationResult> {
  if (pages.length === 0) {
    throw new PdfOperationError(
      'Nenhuma página válida foi fornecida para compressão visual.',
    )
  }

  const doc = await PDFDocument.create()
  for (const item of pages) {
    const jpg = await doc.embedJpg(item.jpegBytes)
    const page = doc.addPage([item.width, item.height])
    page.drawImage(jpg, {
      x: 0,
      y: 0,
      width: item.width,
      height: item.height,
    })
  }

  const savedBytes = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  })

  return {
    bytes: savedBytes,
    pageCount: doc.getPageCount(),
    stats: calculateOptimizationStats(originalBytesLength, savedBytes.byteLength),
    mode: 'visual',
  }
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) {
    throw new PdfOperationError('Falha ao decodificar imagem rasterizada da página.')
  }
  const base64 = dataUrl.slice(commaIndex + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Recompacta todas as páginas como JPEG via Canvas.
 * Transparência: as páginas viram imagens (o texto deixa de ser selecionável).
 */
export async function compressPdfVisually(
  bytes: Uint8Array,
  options: VisualCompressOptions = {},
): Promise<PdfOptimizationResult> {
  const sourceDoc = await loadUnencryptedPdf(bytes)
  const pageCount = sourceDoc.getPageCount()

  if (pageCount > MAX_RENDER_PAGES) {
    throw new PdfOperationError(
      `A compressão visual no navegador é limitada a ${MAX_RENDER_PAGES} páginas por operação para evitar travamentos. Use a otimização estrutural ou divida o PDF primeiro.`,
    )
  }

  const preset = VISUAL_QUALITY_PRESETS[options.quality ?? 'medium']
  const rasterizedPages: RasterizedPageInput[] = []

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    options.onProgress?.(pageNumber, pageCount)
    const sourcePage = sourceDoc.getPage(pageNumber - 1)
    const { width, height } = sourcePage.getSize()

    const rendered = await renderPdfPageToImage(bytes, pageNumber, {
      format: 'jpg',
      scale: preset.scale,
      jpgQuality: preset.jpgQuality,
    })

    rasterizedPages.push({
      width,
      height,
      jpegBytes: dataUrlToUint8Array(rendered.dataUrl),
    })
  }

  return buildVisualCompressedPdfFromJpegs(rasterizedPages, bytes.byteLength)
}
