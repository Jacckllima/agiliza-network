import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib'
import { PdfOperationError, type PdfOperationOutput } from './pdf-operations.ts'
import { sanitizeForWinAnsi } from './convert-to-pdf.ts'

export type PageNumberPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'top-right'
  | 'top-left'

export type PageNumberFormat = 'number' | 'of-total'

export interface PageNumberOptions {
  position: PageNumberPosition
  format: PageNumberFormat
  startNumber: number
  fontSize?: number
}

export interface WatermarkOptions {
  text?: string
  imagePngBytes?: Uint8Array
  opacity: number
  rotation: number
  fontSize?: number
  imageScalePercent?: number
}

export interface CropMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PdfFormFieldDescriptor {
  name: string
  type: 'text' | 'checkbox' | 'dropdown'
  value: string | boolean
  options?: string[]
}

export interface RedactionBox {
  pageNumber: number
  /** Esquerda em % da largura da página (0 a 100) */
  xPercent: number
  /** Topo em % da altura da página (0 a 100) */
  yPercent: number
  /** Largura em % (1 a 100) */
  widthPercent: number
  /** Altura em % (1 a 100) */
  heightPercent: number
}

export interface PageDiffSummary {
  pageNumber: number
  status: 'equal' | 'modified' | 'only-a' | 'only-b'
  textA: string
  textB: string
}

async function loadEditablePdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('encrypted') || message.includes('password')) {
      throw new PdfOperationError(
        'Este PDF está protegido por senha e não pode ser editado nesta etapa.',
      )
    }
    throw new PdfOperationError(
      'Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.',
    )
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

export async function addPageNumbersToPdf(
  pdfBytes: Uint8Array,
  options: PageNumberOptions,
): Promise<PdfOperationOutput> {
  const doc = await loadEditablePdf(pdfBytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const totalPages = doc.getPageCount()
  const startNumber = Math.max(1, Math.floor(options.startNumber || 1))
  const fontSize = clamp(options.fontSize ?? 11, 8, 24)
  const marginX = 32
  const marginY = 24

  for (let i = 0; i < totalPages; i += 1) {
    const page = doc.getPage(i)
    const { width, height } = page.getSize()
    const currentNum = startNumber + i
    const totalNum = startNumber + totalPages - 1
    const label =
      options.format === 'of-total'
        ? `${currentNum} de ${totalNum}`
        : `${currentNum}`

    const textWidth = font.widthOfTextAtSize(label, fontSize)
    const isTop = options.position.startsWith('top-')
    const y = isTop ? height - marginY - fontSize : marginY

    let x = (width - textWidth) / 2
    if (options.position.endsWith('-left')) {
      x = marginX
    } else if (options.position.endsWith('-right')) {
      x = Math.max(marginX, width - marginX - textWidth)
    }

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.2, 0.25, 0.33),
    })
  }

  return {
    bytes: await doc.save(),
    pageCount: totalPages,
  }
}

export async function addWatermarkToPdf(
  pdfBytes: Uint8Array,
  options: WatermarkOptions,
): Promise<PdfOperationOutput> {
  const cleanText = options.text ? sanitizeForWinAnsi(options.text).trim() : ''
  const hasImage = Boolean(
    options.imagePngBytes && options.imagePngBytes.byteLength > 0,
  )

  if (!cleanText && !hasImage) {
    throw new PdfOperationError(
      'Informe um texto ou envie uma imagem PNG para aplicar como marca d água.',
    )
  }

  const doc = await loadEditablePdf(pdfBytes)
  const totalPages = doc.getPageCount()
  const opacity = clamp(options.opacity, 0.05, 1)
  const rotation = Number.isFinite(options.rotation) ? options.rotation : -35

  const font = cleanText
    ? await doc.embedFont(StandardFonts.HelveticaBold)
    : null
  let embeddedImage = null
  if (hasImage && options.imagePngBytes) {
    try {
      embeddedImage = await doc.embedPng(options.imagePngBytes)
    } catch {
      throw new PdfOperationError(
        'A imagem da marca d água não é um arquivo PNG válido.',
      )
    }
  }

  for (let i = 0; i < totalPages; i += 1) {
    const page = doc.getPage(i)
    const { width, height } = page.getSize()

    if (embeddedImage) {
      const scalePercent = clamp(options.imageScalePercent ?? 40, 10, 85) / 100
      const targetWidth = width * scalePercent
      const aspect =
        embeddedImage.height > 0
          ? embeddedImage.width / embeddedImage.height
          : 1
      const targetHeight = targetWidth / aspect

      page.drawImage(embeddedImage, {
        x: (width - targetWidth) / 2,
        y: (height - targetHeight) / 2,
        width: targetWidth,
        height: targetHeight,
        opacity,
        rotate: degrees(rotation),
      })
    } else if (font && cleanText) {
      const fontSize = clamp(options.fontSize ?? 42, 12, 96)
      const textWidth = font.widthOfTextAtSize(cleanText, fontSize)
      page.drawText(cleanText, {
        x: Math.max(20, (width - textWidth) / 2),
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(0.4, 0.45, 0.55),
        opacity,
        rotate: degrees(rotation),
      })
    }
  }

  return {
    bytes: await doc.save(),
    pageCount: totalPages,
  }
}

export async function cropPdfMargins(
  pdfBytes: Uint8Array,
  margins: CropMargins,
  pageNumbers?: readonly number[],
): Promise<PdfOperationOutput> {
  const top = Math.max(0, margins.top)
  const right = Math.max(0, margins.right)
  const bottom = Math.max(0, margins.bottom)
  const left = Math.max(0, margins.left)

  if (top === 0 && right === 0 && bottom === 0 && left === 0) {
    throw new PdfOperationError(
      'Informe ao menos uma margem maior que 0 para recortar o PDF.',
    )
  }

  const doc = await loadEditablePdf(pdfBytes)
  const totalPages = doc.getPageCount()
  const targets =
    pageNumbers && pageNumbers.length > 0
      ? pageNumbers
      : Array.from({ length: totalPages }, (_, idx) => idx + 1)

  for (const pageNumber of targets) {
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      throw new PdfOperationError(
        `Página ${pageNumber} fora do intervalo permitido (1 a ${totalPages}).`,
      )
    }

    const page = doc.getPage(pageNumber - 1)
    const { x, y, width, height } = page.getCropBox()
    const nextWidth = width - left - right
    const nextHeight = height - top - bottom

    if (nextWidth < 36 || nextHeight < 36) {
      throw new PdfOperationError(
        `As margens informadas são grandes demais para a página ${pageNumber}. Reduza o recorte para manter área útil mínima.`,
      )
    }

    page.setCropBox(x + left, y + bottom, nextWidth, nextHeight)
  }

  return {
    bytes: await doc.save(),
    pageCount: totalPages,
  }
}

export async function flattenPdfForm(
  pdfBytes: Uint8Array,
): Promise<PdfOperationOutput & { flattenedFields: number }> {
  const doc = await loadEditablePdf(pdfBytes)
  const form = doc.getForm()
  const fieldCount = form.getFields().length

  if (fieldCount > 0) {
    form.flatten()
  }

  return {
    bytes: await doc.save(),
    pageCount: doc.getPageCount(),
    flattenedFields: fieldCount,
  }
}

export async function inspectPdfFormFields(
  pdfBytes: Uint8Array,
): Promise<{ pageCount: number; fields: PdfFormFieldDescriptor[] }> {
  const doc = await loadEditablePdf(pdfBytes)
  const form = doc.getForm()
  const rawFields = form.getFields()
  const fields: PdfFormFieldDescriptor[] = []

  for (const field of rawFields) {
    const name = field.getName()
    if (field instanceof PDFTextField) {
      fields.push({
        name,
        type: 'text',
        value: field.getText() ?? '',
      })
    } else if (field instanceof PDFCheckBox) {
      fields.push({
        name,
        type: 'checkbox',
        value: field.isChecked(),
      })
    } else if (field instanceof PDFDropdown) {
      const selected = field.getSelected()
      fields.push({
        name,
        type: 'dropdown',
        value: selected[0] ?? '',
        options: field.getOptions(),
      })
    }
  }

  return {
    pageCount: doc.getPageCount(),
    fields,
  }
}

export async function fillPdfFormFields(
  pdfBytes: Uint8Array,
  values: Record<string, string | boolean>,
  shouldFlatten = false,
): Promise<PdfOperationOutput> {
  const doc = await loadEditablePdf(pdfBytes)
  const form = doc.getForm()
  const rawFields = form.getFields()

  if (rawFields.length === 0) {
    throw new PdfOperationError(
      'Este PDF não possui campos de formulário preenchíveis (AcroForm).',
    )
  }

  for (const field of rawFields) {
    const name = field.getName()
    if (!(name in values)) continue
    const nextValue = values[name]

    if (field instanceof PDFTextField && typeof nextValue === 'string') {
      field.setText(sanitizeForWinAnsi(nextValue))
    } else if (field instanceof PDFCheckBox && typeof nextValue === 'boolean') {
      if (nextValue) {
        field.check()
      } else {
        field.uncheck()
      }
    } else if (field instanceof PDFDropdown && typeof nextValue === 'string') {
      if (nextValue && field.getOptions().includes(nextValue)) {
        field.select(nextValue)
      }
    }
  }

  if (shouldFlatten) {
    form.flatten()
  }

  return {
    bytes: await doc.save(),
    pageCount: doc.getPageCount(),
  }
}

export async function applyVisualRedactionToPdf(
  pdfBytes: Uint8Array,
  redactions: readonly RedactionBox[],
): Promise<PdfOperationOutput> {
  if (redactions.length === 0) {
    throw new PdfOperationError(
      'Defina pelo menos uma área de tarja antes de aplicar.',
    )
  }

  const doc = await loadEditablePdf(pdfBytes)
  const totalPages = doc.getPageCount()

  for (const box of redactions) {
    if (
      !Number.isInteger(box.pageNumber) ||
      box.pageNumber < 1 ||
      box.pageNumber > totalPages
    ) {
      throw new PdfOperationError(
        `Página ${box.pageNumber} fora do intervalo permitido (1 a ${totalPages}).`,
      )
    }

    const page = doc.getPage(box.pageNumber - 1)
    const { width, height } = page.getSize()

    const rectW = (clamp(box.widthPercent, 1, 100) / 100) * width
    const rectH = (clamp(box.heightPercent, 1, 100) / 100) * height
    const rectX = clamp((box.xPercent / 100) * width, 0, Math.max(0, width - rectW))
    const topFromTop = (clamp(box.yPercent, 0, 100) / 100) * height
    const rectY = clamp(
      height - topFromTop - rectH,
      0,
      Math.max(0, height - rectH),
    )

    page.drawRectangle({
      x: rectX,
      y: rectY,
      width: rectW,
      height: rectH,
      color: rgb(0, 0, 0),
    })
  }

  return {
    bytes: await doc.save(),
    pageCount: totalPages,
  }
}

export async function replacePageWithRasterizedJpeg(
  pdfBytes: Uint8Array,
  pageNumber: number,
  jpegBytes: Uint8Array,
): Promise<PdfOperationOutput> {
  const doc = await loadEditablePdf(pdfBytes)
  const totalPages = doc.getPageCount()
  if (pageNumber < 1 || pageNumber > totalPages) {
    throw new PdfOperationError(
      `Página ${pageNumber} fora do intervalo permitido (1 a ${totalPages}).`,
    )
  }

  const originalPage = doc.getPage(pageNumber - 1)
  const { width, height } = originalPage.getSize()
  const embedded = await doc.embedJpg(jpegBytes)

  doc.removePage(pageNumber - 1)
  const freshPage = doc.insertPage(pageNumber - 1, [width, height])
  freshPage.drawImage(embedded, {
    x: 0,
    y: 0,
    width,
    height,
  })

  return {
    bytes: await doc.save(),
    pageCount: doc.getPageCount(),
  }
}

export function compareExtractedPages(
  pagesA: readonly { pageNumber: number; text: string }[],
  pagesB: readonly { pageNumber: number; text: string }[],
): {
  totalCompared: number
  equalCount: number
  modifiedCount: number
  diffs: PageDiffSummary[]
} {
  const maxPages = Math.max(pagesA.length, pagesB.length)
  const diffs: PageDiffSummary[] = []
  let equalCount = 0
  let modifiedCount = 0

  for (let i = 0; i < maxPages; i += 1) {
    const a = pagesA[i]
    const b = pagesB[i]
    const normA = (a?.text ?? '').replace(/\s+/g, ' ').trim()
    const normB = (b?.text ?? '').replace(/\s+/g, ' ').trim()

    let status: PageDiffSummary['status']
    if (a && !b) {
      status = 'only-a'
      modifiedCount += 1
    } else if (!a && b) {
      status = 'only-b'
      modifiedCount += 1
    } else if (normA === normB) {
      status = 'equal'
      equalCount += 1
    } else {
      status = 'modified'
      modifiedCount += 1
    }

    diffs.push({
      pageNumber: i + 1,
      status,
      textA: normA,
      textB: normB,
    })
  }

  return {
    totalCompared: maxPages,
    equalCount,
    modifiedCount,
    diffs,
  }
}
