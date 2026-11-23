import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  extractPdfPages,
  inspectPdfBytes,
  mergePdfDocuments,
  parsePageRange,
  PdfOperationError,
  removePdfPages,
  rotatePdfPages,
} from './pdf-operations.ts'

async function createSyntheticPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage([400 + i * 10, 600])
  }
  return doc.save()
}

describe('parsePageRange', () => {
  it('parses single pages, ranges, spaces and deduplicates preserving order', () => {
    assert.deepEqual(parsePageRange('1-3, 5, 3, 8-10', 10), [1, 2, 3, 5, 8, 9, 10])
    assert.deepEqual(parsePageRange('4, 1-2', 5), [4, 1, 2])
  })

  it('rejects empty, zero, inverted, out-of-bounds and non-numeric expressions', () => {
    assert.throws(() => parsePageRange('', 5), PdfOperationError)
    assert.throws(() => parsePageRange('0', 5), PdfOperationError)
    assert.throws(() => parsePageRange('5-2', 5), PdfOperationError)
    assert.throws(() => parsePageRange('1-6', 5), PdfOperationError)
    assert.throws(() => parsePageRange('abc', 5), PdfOperationError)
    assert.throws(() => parsePageRange('1,,2', 5), PdfOperationError)
  })
})

describe('pdf-operations with synthetic PDFs', () => {
  it('inspects page count and rejects invalid binary data', async () => {
    const pdf3 = await createSyntheticPdf(3)
    const info = await inspectPdfBytes(pdf3)
    assert.equal(info.pageCount, 3)

    const fakeBytes = new TextEncoder().encode('not a pdf')
    await assert.rejects(() => inspectPdfBytes(fakeBytes), PdfOperationError)
  })

  it('merges multiple PDFs preserving total page count', async () => {
    const pdfA = await createSyntheticPdf(2)
    const pdfB = await createSyntheticPdf(3)

    const merged = await mergePdfDocuments([pdfA, pdfB])
    assert.equal(merged.pageCount, 5)

    const inspected = await inspectPdfBytes(merged.bytes)
    assert.equal(inspected.pageCount, 5)
  })

  it('rejects merging fewer than 2 PDFs', async () => {
    const pdfA = await createSyntheticPdf(2)
    await assert.rejects(() => mergePdfDocuments([pdfA]), PdfOperationError)
  })

  it('extracts requested page range into a new PDF', async () => {
    const pdf5 = await createSyntheticPdf(5)
    const pages = parsePageRange('2-4', 5)
    const extracted = await extractPdfPages(pdf5, pages)

    assert.equal(extracted.pageCount, 3)
    const loaded = await PDFDocument.load(extracted.bytes)
    assert.equal(loaded.getPage(0).getWidth(), 410)
    assert.equal(loaded.getPage(2).getWidth(), 430)
  })

  it('rotates all pages or selected pages accurately', async () => {
    const pdf3 = await createSyntheticPdf(3)

    const rotatedSelected = await rotatePdfPages(pdf3, 90, [2])
    const loadedSelected = await PDFDocument.load(rotatedSelected.bytes)
    assert.equal(loadedSelected.getPage(0).getRotation().angle, 0)
    assert.equal(loadedSelected.getPage(1).getRotation().angle, 90)
    assert.equal(loadedSelected.getPage(2).getRotation().angle, 0)

    const rotatedAll = await rotatePdfPages(rotatedSelected.bytes, 180)
    const loadedAll = await PDFDocument.load(rotatedAll.bytes)
    assert.equal(loadedAll.getPage(0).getRotation().angle, 180)
    assert.equal(loadedAll.getPage(1).getRotation().angle, 270)
    assert.equal(loadedAll.getPage(2).getRotation().angle, 180)
  })

  it('removes selected pages and blocks removing all pages', async () => {
    const pdf4 = await createSyntheticPdf(4)
    const reduced = await removePdfPages(pdf4, [1, 3])

    assert.equal(reduced.pageCount, 2)
    const loaded = await PDFDocument.load(reduced.bytes)
    assert.equal(loaded.getPage(0).getWidth(), 410)
    assert.equal(loaded.getPage(1).getWidth(), 430)

    await assert.rejects(
      () => removePdfPages(pdf4, [1, 2, 3, 4]),
      PdfOperationError,
    )
  })
})
