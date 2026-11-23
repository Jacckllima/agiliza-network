import { PDFDocument } from 'pdf-lib'
import { PdfOperationError, type PdfOperationOutput } from './pdf-operations.ts'

export interface SignaturePlacement {
  /** Número da página (1-based) */
  pageNumber: number
  /** Posição horizontal do centro da assinatura em % da largura da página (0 a 100) */
  xPercent: number
  /** Posição vertical do centro da assinatura em % da altura da página a partir do topo (0 a 100) */
  yPercent: number
  /** Largura da assinatura em % da largura da página (5 a 80) */
  widthPercent: number
}

export interface PdfRect {
  x: number
  y: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

/**
 * Converte coordenadas percentuais top-down (UI) em retângulo PDF bottom-up
 * com clamping automático dentro dos limites da página.
 */
export function computeSignaturePdfRect(params: {
  pageWidth: number
  pageHeight: number
  imageWidth: number
  imageHeight: number
  xPercent: number
  yPercent: number
  widthPercent: number
}): PdfRect {
  const { pageWidth, pageHeight, imageWidth, imageHeight } = params
  const safeAspect =
    imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 3

  const clampedWidthPercent = clamp(params.widthPercent, 5, 80)
  let width = (clampedWidthPercent / 100) * pageWidth
  let height = width / safeAspect

  const maxHeight = pageHeight * 0.5
  if (height > maxHeight) {
    height = maxHeight
    width = height * safeAspect
  }

  const centerX = (clamp(params.xPercent, 0, 100) / 100) * pageWidth
  const centerYFromTop = (clamp(params.yPercent, 0, 100) / 100) * pageHeight
  const centerYFromBottom = pageHeight - centerYFromTop

  const x = clamp(centerX - width / 2, 0, Math.max(0, pageWidth - width))
  const y = clamp(centerYFromBottom - height / 2, 0, Math.max(0, pageHeight - height))

  return { x, y, width, height }
}

export async function applyVisualSignatureToPdf(
  pdfBytes: Uint8Array,
  signaturePngBytes: Uint8Array,
  placement: SignaturePlacement,
): Promise<PdfOperationOutput> {
  if (!signaturePngBytes || signaturePngBytes.byteLength === 0) {
    throw new PdfOperationError(
      'Crie ou envie uma assinatura antes de aplicar ao PDF.',
    )
  }

  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(pdfBytes)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('encrypted') || message.includes('password')) {
      throw new PdfOperationError(
        'Este PDF está protegido por senha e não pode ser assinado nesta etapa.',
      )
    }
    throw new PdfOperationError(
      'Não foi possível abrir este PDF. Verifique se o arquivo não está corrompido.',
    )
  }

  const totalPages = doc.getPageCount()
  if (
    !Number.isInteger(placement.pageNumber) ||
    placement.pageNumber < 1 ||
    placement.pageNumber > totalPages
  ) {
    throw new PdfOperationError(
      `Página ${placement.pageNumber} fora do intervalo do documento (1 a ${totalPages}).`,
    )
  }

  let embeddedSignature
  try {
    embeddedSignature = await doc.embedPng(signaturePngBytes)
  } catch {
    throw new PdfOperationError(
      'A imagem de assinatura não é um PNG válido. Desenhe, digite ou envie um arquivo PNG válido.',
    )
  }

  const page = doc.getPage(placement.pageNumber - 1)
  const { width: pageWidth, height: pageHeight } = page.getSize()

  const rect = computeSignaturePdfRect({
    pageWidth,
    pageHeight,
    imageWidth: embeddedSignature.width,
    imageHeight: embeddedSignature.height,
    xPercent: placement.xPercent,
    yPercent: placement.yPercent,
    widthPercent: placement.widthPercent,
  })

  page.drawImage(embeddedSignature, {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  })

  const bytes = await doc.save()
  return {
    bytes,
    pageCount: totalPages,
  }
}
