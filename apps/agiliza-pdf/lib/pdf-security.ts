import { PDFDocument as CantooPDFDocument } from '@cantoo/pdf-lib'
import { PdfOperationError, type PdfOperationOutput } from './pdf-operations.ts'

export interface PdfSecurityInfo {
  isEncrypted: boolean
  pageCount: number | null
}

export interface ProtectPdfOptions {
  userPassword: string
  ownerPassword?: string
  allowPrinting?: boolean
  allowCopying?: boolean
  allowModifying?: boolean
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 5) return false
  const headerSlice = bytes.subarray(0, Math.min(bytes.byteLength, 1024))
  const text = new TextDecoder('latin1').decode(headerSlice)
  return text.includes('%PDF-')
}

function isEncryptionError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('encrypted') ||
    message.includes('password') ||
    message.includes('decrypt')
  )
}

export async function inspectPdfSecurity(
  bytes: Uint8Array,
): Promise<PdfSecurityInfo> {
  if (!hasPdfHeader(bytes)) {
    throw new PdfOperationError(
      'O arquivo selecionado não parece ser um PDF válido.',
    )
  }

  try {
    const doc = await CantooPDFDocument.load(bytes)
    return {
      isEncrypted: doc.isEncrypted,
      pageCount: doc.getPageCount(),
    }
  } catch (error) {
    if (isEncryptionError(error)) {
      return {
        isEncrypted: true,
        pageCount: null,
      }
    }
    throw new PdfOperationError(
      'Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.',
    )
  }
}

export async function protectPdfWithPassword(
  bytes: Uint8Array,
  options: ProtectPdfOptions,
): Promise<PdfOperationOutput> {
  if (!hasPdfHeader(bytes)) {
    throw new PdfOperationError(
      'O arquivo selecionado não parece ser um PDF válido.',
    )
  }

  const userPassword = options.userPassword
  if (!userPassword || userPassword.trim().length === 0) {
    throw new PdfOperationError('Informe uma senha para proteger o PDF.')
  }

  if (userPassword.length < 4) {
    throw new PdfOperationError(
      'Use uma senha com pelo menos 4 caracteres para proteger o documento.',
    )
  }

  const ownerPassword =
    options.ownerPassword && options.ownerPassword.trim().length > 0
      ? options.ownerPassword
      : userPassword

  let doc: CantooPDFDocument
  try {
    doc = await CantooPDFDocument.load(bytes)
  } catch (error) {
    if (isEncryptionError(error)) {
      throw new PdfOperationError(
        'Este PDF já está protegido por senha. Desbloqueie o arquivo primeiro antes de aplicar uma nova senha.',
      )
    }
    throw new PdfOperationError(
      'Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.',
    )
  }

  const allowPrinting = options.allowPrinting ?? true
  const allowCopying = options.allowCopying ?? false
  const allowModifying = options.allowModifying ?? false

  doc.encrypt({
    userPassword,
    ownerPassword,
    algorithm: 'AES-256',
    permissions: {
      printing: allowPrinting ? 'highResolution' : false,
      copying: allowCopying,
      modifying: allowModifying,
      annotating: allowModifying,
      fillingForms: allowModifying,
      contentAccessibility: true,
    },
  })

  const savedBytes = await doc.save()
  return {
    bytes: savedBytes,
    pageCount: doc.getPageCount(),
  }
}

export async function unlockPdfWithPassword(
  bytes: Uint8Array,
  password: string,
): Promise<PdfOperationOutput> {
  if (!hasPdfHeader(bytes)) {
    throw new PdfOperationError(
      'O arquivo selecionado não parece ser um PDF válido.',
    )
  }

  if (!password || password.length === 0) {
    throw new PdfOperationError(
      'Informe a senha do documento para gerar uma cópia desbloqueada.',
    )
  }

  let sourceDoc: CantooPDFDocument
  try {
    sourceDoc = await CantooPDFDocument.load(bytes, { password })
  } catch (error) {
    if (isEncryptionError(error)) {
      throw new PdfOperationError(
        'Senha incorreta. Informe a senha válida do documento para desbloqueá-lo.',
      )
    }
    throw new PdfOperationError(
      'Não foi possível desbloquear este PDF. Verifique se o arquivo não está corrompido.',
    )
  }

  const unlockedDoc = await CantooPDFDocument.create()
  const indices = sourceDoc.getPageIndices()
  const copiedPages = await unlockedDoc.copyPages(sourceDoc, indices)
  for (const page of copiedPages) {
    unlockedDoc.addPage(page)
  }

  const title = sourceDoc.getTitle()
  if (title) unlockedDoc.setTitle(title)
  const author = sourceDoc.getAuthor()
  if (author) unlockedDoc.setAuthor(author)
  const subject = sourceDoc.getSubject()
  if (subject) unlockedDoc.setSubject(subject)

  const savedBytes = await unlockedDoc.save()
  return {
    bytes: savedBytes,
    pageCount: unlockedDoc.getPageCount(),
  }
}
