import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  calculateOptimizationStats,
  optimizePdfStructurally,
} from './pdf-optimize.ts'
import { PdfOperationError } from './pdf-operations.ts'
import { protectPdfWithPassword } from './pdf-security.ts'

async function createSamplePdf(pageCount = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('Relatório com Metadados Longos')
  doc.setAuthor('Autor de Teste')
  doc.setSubject('Assunto de Teste')
  doc.setKeywords(['palavra1', 'palavra2', 'palavra3'])
  for (let i = 0; i < pageCount; i += 1) {
    const page = doc.addPage([595, 842])
    page.drawText(`Página ${i + 1} com texto selecionável`, {
      x: 50,
      y: 780,
      size: 14,
    })
  }
  return doc.save({ useObjectStreams: false })
}

test('calculateOptimizationStats computes real savings and never fakes reduction', () => {
  const reduced = calculateOptimizationStats(1000, 750)
  assert.equal(reduced.reduced, true)
  assert.equal(reduced.savedBytes, 250)
  assert.equal(reduced.savedPercent, 25)

  const unchanged = calculateOptimizationStats(1000, 1000)
  assert.equal(unchanged.reduced, false)
  assert.equal(unchanged.savedBytes, 0)
  assert.equal(unchanged.savedPercent, 0)

  const larger = calculateOptimizationStats(1000, 1200)
  assert.equal(larger.reduced, false)
  assert.equal(larger.savedBytes, -200)
  assert.equal(larger.savedPercent, 0)
})

test('optimizePdfStructurally rewrites PDF cleanly preserving page count', async () => {
  const original = await createSamplePdf(3)
  const result = await optimizePdfStructurally(original, {
    stripMetadata: true,
  })

  assert.equal(result.mode, 'structural')
  assert.equal(result.pageCount, 3)
  assert.equal(result.stats.originalBytes, original.byteLength)
  assert.equal(result.stats.optimizedBytes, result.bytes.byteLength)

  const reloaded = await PDFDocument.load(result.bytes)
  assert.equal(reloaded.getPageCount(), 3)
})

test('optimizePdfStructurally rejects corrupted and password-protected PDFs clearly', async () => {
  await assert.rejects(
    () => optimizePdfStructurally(new Uint8Array([1, 2, 3, 4, 5])),
    (error: unknown) =>
      error instanceof PdfOperationError && /PDF válido/i.test(error.message),
  )

  const sample = await createSamplePdf(1)
  const encrypted = await protectPdfWithPassword(sample, {
    userPassword: 'Senha123',
  })

  await assert.rejects(
    () => optimizePdfStructurally(encrypted.bytes),
    (error: unknown) =>
      error instanceof PdfOperationError &&
      /protegido por senha/i.test(error.message),
  )
})
