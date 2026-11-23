import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  applyVisualSignatureToPdf,
  computeSignaturePdfRect,
} from './pdf-sign.ts'
import { PdfOperationError } from './pdf-operations.ts'

const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function samplePngBytes(): Uint8Array {
  return Uint8Array.from(Buffer.from(SAMPLE_PNG_BASE64, 'base64'))
}

async function createSyntheticPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage([595, 842])
  }
  return doc.save()
}

describe('pdf-sign', () => {
  it('clamps out-of-bounds coordinates safely inside page dimensions', () => {
    const rect = computeSignaturePdfRect({
      pageWidth: 600,
      pageHeight: 800,
      imageWidth: 300,
      imageHeight: 100,
      xPercent: 150,
      yPercent: -20,
      widthPercent: 30,
    })

    assert.ok(rect.x >= 0 && rect.x + rect.width <= 600.01)
    assert.ok(rect.y >= 0 && rect.y + rect.height <= 800.01)
    assert.equal(rect.width, 180)
    assert.equal(rect.height, 60)
  })

  it('embeds PNG visual signature onto requested page of synthetic PDF', async () => {
    const pdfBytes = await createSyntheticPdf(2)
    const sigBytes = samplePngBytes()

    const result = await applyVisualSignatureToPdf(pdfBytes, sigBytes, {
      pageNumber: 2,
      xPercent: 50,
      yPercent: 80,
      widthPercent: 25,
    })

    assert.equal(result.pageCount, 2)
    assert.ok(result.bytes.byteLength > pdfBytes.byteLength)

    const loaded = await PDFDocument.load(result.bytes)
    assert.equal(loaded.getPageCount(), 2)
  })

  it('rejects empty signature, invalid PNG, and out-of-range page numbers', async () => {
    const pdfBytes = await createSyntheticPdf(1)
    const sigBytes = samplePngBytes()

    await assert.rejects(
      () =>
        applyVisualSignatureToPdf(pdfBytes, new Uint8Array(), {
          pageNumber: 1,
          xPercent: 50,
          yPercent: 50,
          widthPercent: 25,
        }),
      PdfOperationError,
    )

    await assert.rejects(
      () =>
        applyVisualSignatureToPdf(
          pdfBytes,
          new TextEncoder().encode('invalid-png'),
          {
            pageNumber: 1,
            xPercent: 50,
            yPercent: 50,
            widthPercent: 25,
          },
        ),
      PdfOperationError,
    )

    await assert.rejects(
      () =>
        applyVisualSignatureToPdf(pdfBytes, sigBytes, {
          pageNumber: 5,
          xPercent: 50,
          yPercent: 50,
          widthPercent: 25,
        }),
      PdfOperationError,
    )
  })
})
