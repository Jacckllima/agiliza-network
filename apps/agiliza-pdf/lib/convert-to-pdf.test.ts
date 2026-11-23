import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  A4_HEIGHT,
  A4_WIDTH,
  calculateFittedImageRect,
  convertImagesToPdf,
  convertTextToPdf,
  sanitizeForWinAnsi,
} from './convert-to-pdf.ts'
import { PdfOperationError } from './pdf-operations.ts'

// PNG 1x1 válido (pixel azul) em base64 para testes determinísticos sem depender de disco
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function samplePngBytes(): Uint8Array {
  return Uint8Array.from(Buffer.from(SAMPLE_PNG_BASE64, 'base64'))
}

describe('convert-to-pdf', () => {
  it('sanitizes typographic punctuation and unsupported Unicode safely for WinAnsi', () => {
    const cleaned = sanitizeForWinAnsi('“Olá” — teste… com acentuação: çãõé 🚀')
    assert.equal(cleaned, '"Olá" - teste... com acentuação: çãõé  ')
  })

  it('fits image inside page preserving aspect ratio', () => {
    const rect = calculateFittedImageRect(2000, 1000, A4_WIDTH, A4_HEIGHT, 24)
    assert.ok(Math.abs(rect.width / rect.height - 2) < 0.001)
    assert.ok(rect.x >= 24 - 0.01)
    assert.ok(rect.y >= 24 - 0.01)
  })

  it('converts synthetic PNG images into a valid multi-page A4 PDF', async () => {
    const png = samplePngBytes()
    const output = await convertImagesToPdf(
      [
        { name: 'foto-1.png', format: 'png', bytes: png },
        { name: 'foto-2.png', format: 'png', bytes: png },
      ],
      { orientation: 'portrait', margin: 'standard' },
    )

    assert.equal(output.pageCount, 2)
    const loaded = await PDFDocument.load(output.bytes)
    assert.equal(loaded.getPageCount(), 2)
    assert.ok(Math.abs(loaded.getPage(0).getWidth() - A4_WIDTH) < 0.5)
    assert.ok(Math.abs(loaded.getPage(0).getHeight() - A4_HEIGHT) < 0.5)
  })

  it('rejects empty image list and corrupted image bytes', async () => {
    await assert.rejects(() => convertImagesToPdf([]), PdfOperationError)
    await assert.rejects(
      () =>
        convertImagesToPdf([
          {
            name: 'quebrada.png',
            format: 'png',
            bytes: new TextEncoder().encode('not-an-image'),
          },
        ]),
      PdfOperationError,
    )
  })

  it('converts long UTF-8 Portuguese text into a multi-page A4 PDF', async () => {
    const longParagraph =
      'Relatório técnico com acentuação completa (ção, áéíóú, âêô, à) para validar quebra de linha e paginação automática no AgilizaPDF. '.repeat(
        80,
      )

    const output = await convertTextToPdf(longParagraph, {
      title: 'Documento de Teste A4',
      fontSize: 12,
      margin: 'standard',
    })

    assert.ok(output.pageCount >= 2)
    const loaded = await PDFDocument.load(output.bytes)
    assert.equal(loaded.getPageCount(), output.pageCount)
  })

  it('rejects empty text input', async () => {
    await assert.rejects(() => convertTextToPdf('   \n  '), PdfOperationError)
  })
})
