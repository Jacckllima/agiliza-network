import { PDFDocument, degrees } from 'pdf-lib'

export type RotationAngle = 90 | 180 | 270

export interface PdfOperationOutput {
  bytes: Uint8Array
  pageCount: number
}

export class PdfOperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfOperationError'
  }
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5) return false
  const headerSlice = bytes.subarray(0, Math.min(bytes.byteLength, 1024))
  const text = new TextDecoder('latin1').decode(headerSlice)
  return text.includes('%PDF-')
}

async function loadPdfDocumentSafe(bytes: Uint8Array): Promise<PDFDocument> {
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
        'Este PDF está protegido por senha e não pode ser processado nesta etapa.',
      )
    }
    throw new PdfOperationError(
      'Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.',
    )
  }
}

/**
 * Faz o parse de uma expressão de páginas 1-based (ex.: "1-3, 5, 8-10")
 * retornando números de páginas únicos na ordem informada.
 */
export function parsePageRange(expression: string, totalPages: number): number[] {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new PdfOperationError('O documento precisa ter pelo menos 1 página.')
  }

  const trimmed = expression.trim()
  if (!trimmed) {
    throw new PdfOperationError(
      'Informe ao menos uma página ou intervalo (ex.: 1-3, 5).',
    )
  }

  const parts = trimmed.split(',')
  const result: number[] = []
  const seen = new Set<number>()

  for (const rawPart of parts) {
    const token = rawPart.trim()
    if (!token) {
      throw new PdfOperationError(
        'Expressão de páginas inválida. Remova vírgulas extras.',
      )
    }

    if (token.includes('-')) {
      const rangePieces = token.split('-')
      if (rangePieces.length !== 2) {
        throw new PdfOperationError(
          `Intervalo inválido: "${token}". Use o formato início-fim (ex.: 2-5).`,
        )
      }

      const startRaw = rangePieces[0]?.trim() ?? ''
      const endRaw = rangePieces[1]?.trim() ?? ''
      if (!/^\d+$/.test(startRaw) || !/^\d+$/.test(endRaw)) {
        throw new PdfOperationError(
          `Intervalo inválido: "${token}". Use apenas números inteiros positivos.`,
        )
      }

      const start = Number(startRaw)
      const end = Number(endRaw)

      if (start < 1 || end < 1) {
        throw new PdfOperationError(
          `As páginas começam em 1. Intervalo inválido: "${token}".`,
        )
      }
      if (start > end) {
        throw new PdfOperationError(
          `Intervalo invertido: "${token}". O número inicial deve ser menor ou igual ao final.`,
        )
      }
      if (end > totalPages) {
        throw new PdfOperationError(
          `A página ${end} excede o total do documento (${totalPages} ${totalPages === 1 ? 'página' : 'páginas'}).`,
        )
      }

      for (let page = start; page <= end; page += 1) {
        if (!seen.has(page)) {
          seen.add(page)
          result.push(page)
        }
      }
    } else {
      if (!/^\d+$/.test(token)) {
        throw new PdfOperationError(
          `Valor inválido: "${token}". Use números ou intervalos como 1-3, 5.`,
        )
      }

      const page = Number(token)
      if (page < 1) {
        throw new PdfOperationError('As páginas começam em 1.')
      }
      if (page > totalPages) {
        throw new PdfOperationError(
          `A página ${page} excede o total do documento (${totalPages} ${totalPages === 1 ? 'página' : 'páginas'}).`,
        )
      }

      if (!seen.has(page)) {
        seen.add(page)
        result.push(page)
      }
    }
  }

  return result
}

export async function inspectPdfBytes(
  bytes: Uint8Array,
): Promise<{ pageCount: number }> {
  const doc = await loadPdfDocumentSafe(bytes)
  return { pageCount: doc.getPageCount() }
}

export async function mergePdfDocuments(
  files: readonly Uint8Array[],
): Promise<PdfOperationOutput> {
  if (files.length < 2) {
    throw new PdfOperationError(
      'Selecione pelo menos 2 arquivos PDF para juntar.',
    )
  }

  const merged = await PDFDocument.create()

  for (const fileBytes of files) {
    const source = await loadPdfDocumentSafe(fileBytes)
    const indices = source.getPageIndices()
    const copiedPages = await merged.copyPages(source, indices)
    for (const page of copiedPages) {
      merged.addPage(page)
    }
  }

  const bytes = await merged.save()
  return {
    bytes,
    pageCount: merged.getPageCount(),
  }
}

export async function extractPdfPages(
  sourceBytes: Uint8Array,
  pageNumbers: readonly number[],
): Promise<PdfOperationOutput> {
  const source = await loadPdfDocumentSafe(sourceBytes)
  const totalPages = source.getPageCount()

  if (pageNumbers.length === 0) {
    throw new PdfOperationError(
      'Selecione ao menos 1 página para extrair do PDF.',
    )
  }

  const indices: number[] = []
  for (const pageNumber of pageNumbers) {
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      throw new PdfOperationError(
        `Página ${pageNumber} fora do intervalo permitido (1 a ${totalPages}).`,
      )
    }
    indices.push(pageNumber - 1)
  }

  const output = await PDFDocument.create()
  const copiedPages = await output.copyPages(source, indices)
  for (const page of copiedPages) {
    output.addPage(page)
  }

  const bytes = await output.save()
  return {
    bytes,
    pageCount: output.getPageCount(),
  }
}

export async function rotatePdfPages(
  sourceBytes: Uint8Array,
  angle: RotationAngle,
  pageNumbers?: readonly number[],
): Promise<PdfOperationOutput> {
  const doc = await loadPdfDocumentSafe(sourceBytes)
  const totalPages = doc.getPageCount()

  const targetPages =
    pageNumbers && pageNumbers.length > 0
      ? pageNumbers
      : Array.from({ length: totalPages }, (_, index) => index + 1)

  for (const pageNumber of targetPages) {
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
    const currentAngle = page.getRotation().angle
    const nextAngle = (((currentAngle + angle) % 360) + 360) % 360
    page.setRotation(degrees(nextAngle))
  }

  const bytes = await doc.save()
  return {
    bytes,
    pageCount: doc.getPageCount(),
  }
}

export async function removePdfPages(
  sourceBytes: Uint8Array,
  pageNumbersToRemove: readonly number[],
): Promise<PdfOperationOutput> {
  const source = await loadPdfDocumentSafe(sourceBytes)
  const totalPages = source.getPageCount()

  if (pageNumbersToRemove.length === 0) {
    throw new PdfOperationError(
      'Informe ao menos 1 página para remover do PDF.',
    )
  }

  const removalSet = new Set<number>()
  for (const pageNumber of pageNumbersToRemove) {
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      throw new PdfOperationError(
        `Página ${pageNumber} fora do intervalo permitido (1 a ${totalPages}).`,
      )
    }
    removalSet.add(pageNumber)
  }

  const remainingIndices: number[] = []
  for (let page = 1; page <= totalPages; page += 1) {
    if (!removalSet.has(page)) {
      remainingIndices.push(page - 1)
    }
  }

  if (remainingIndices.length === 0) {
    throw new PdfOperationError(
      'Não é possível remover todas as páginas do documento. Mantenha pelo menos 1 página.',
    )
  }

  const output = await PDFDocument.create()
  const copiedPages = await output.copyPages(source, remainingIndices)
  for (const page of copiedPages) {
    output.addPage(page)
  }

  const bytes = await output.save()
  return {
    bytes,
    pageCount: output.getPageCount(),
  }
}
