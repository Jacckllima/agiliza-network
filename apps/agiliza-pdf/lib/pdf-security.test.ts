import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  inspectPdfSecurity,
  protectPdfWithPassword,
  unlockPdfWithPassword,
} from './pdf-security.ts'
import { PdfOperationError } from './pdf-operations.ts'

async function createSamplePdf(pageCount = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('Documento de Teste')
  for (let i = 0; i < pageCount; i += 1) {
    const page = doc.addPage([400, 600])
    page.drawText(`Pagina ${i + 1}`, { x: 40, y: 540, size: 14 })
  }
  return doc.save()
}

test('protectPdfWithPassword encrypts with AES-256 and unlockPdfWithPassword decrypts cleanly', async () => {
  const original = await createSamplePdf(2)
  const beforeInfo = await inspectPdfSecurity(original)
  assert.equal(beforeInfo.isEncrypted, false)
  assert.equal(beforeInfo.pageCount, 2)

  const protectedResult = await protectPdfWithPassword(original, {
    userPassword: 'SenhaSegura123',
    allowPrinting: true,
    allowCopying: false,
    allowModifying: false,
  })
  assert.equal(protectedResult.pageCount, 2)
  assert.ok(protectedResult.bytes.byteLength > 0)

  const encryptedInfo = await inspectPdfSecurity(protectedResult.bytes)
  assert.equal(encryptedInfo.isEncrypted, true)

  // Senha incorreta deve falhar com erro claro
  await assert.rejects(
    () => unlockPdfWithPassword(protectedResult.bytes, 'SenhaErrada'),
    (error: unknown) =>
      error instanceof PdfOperationError &&
      /Senha incorreta/i.test(error.message),
  )

  // Senha correta gera copia desbloqueada legivel pelo pdf-lib padrao
  const unlockedResult = await unlockPdfWithPassword(
    protectedResult.bytes,
    'SenhaSegura123',
  )
  assert.equal(unlockedResult.pageCount, 2)

  const reloaded = await PDFDocument.load(unlockedResult.bytes)
  assert.equal(reloaded.getPageCount(), 2)

  const afterInfo = await inspectPdfSecurity(unlockedResult.bytes)
  assert.equal(afterInfo.isEncrypted, false)
  assert.equal(afterInfo.pageCount, 2)
})

test('protectPdfWithPassword validates password length and invalid PDFs', async () => {
  const original = await createSamplePdf(1)

  await assert.rejects(
    () => protectPdfWithPassword(original, { userPassword: '123' }),
    (error: unknown) =>
      error instanceof PdfOperationError && /4 caracteres/i.test(error.message),
  )

  await assert.rejects(
    () =>
      protectPdfWithPassword(new Uint8Array([1, 2, 3, 4, 5]), {
        userPassword: 'SenhaValida',
      }),
    (error: unknown) =>
      error instanceof PdfOperationError && /PDF válido/i.test(error.message),
  )
})
