import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExtractedTextFilename,
  buildPageImageFilename,
  formatExtractedPagesText,
  getRenderablePageWindow,
  MAX_RENDER_PAGES,
  normalizePdfJsError,
} from './pdf-to-media.ts'
import { PdfOperationError } from './pdf-operations.ts'

describe('pdf-to-media helpers', () => {
  it('builds predictable image and text filenames', () => {
    assert.equal(
      buildPageImageFilename('relatorio-2026.PDF', 3, 'png'),
      'relatorio-2026-pagina-3.png',
    )
    assert.equal(
      buildPageImageFilename('contrato.pdf', 1, 'jpg'),
      'contrato-pagina-1.jpg',
    )
    assert.equal(
      buildExtractedTextFilename('manual.pdf'),
      'manual-texto.txt',
    )
  })

  it('formats extracted text and detects scanned PDFs without selectable text', () => {
    const withText = formatExtractedPagesText([
      { pageNumber: 1, text: '  Olá   mundo  ' },
      { pageNumber: 2, text: '   ' },
      { pageNumber: 3, text: 'Segunda página com texto' },
    ])
    assert.equal(withText.hasSelectableText, true)
    assert.equal(withText.nonEmptyPages, 2)
    assert.match(withText.combinedText, /=== Página 1 ===\nOlá mundo/)
    assert.match(withText.combinedText, /=== Página 3 ===\nSegunda página com texto/)

    const scannedOnly = formatExtractedPagesText([
      { pageNumber: 1, text: '   ' },
      { pageNumber: 2, text: '' },
    ])
    assert.equal(scannedOnly.hasSelectableText, false)
    assert.equal(scannedOnly.combinedText, '')
  })

  it('paginates thumbnails and caps rendering at MAX_RENDER_PAGES', () => {
    const firstBatch = getRenderablePageWindow(15, 0, 6)
    assert.deepEqual(firstBatch.pages, [1, 2, 3, 4, 5, 6])
    assert.equal(firstBatch.totalBatches, 3)
    assert.equal(firstBatch.isTruncated, false)

    const hugePdf = getRenderablePageWindow(MAX_RENDER_PAGES + 25, 0, 6)
    assert.equal(hugePdf.maxAllowedPages, MAX_RENDER_PAGES)
    assert.equal(hugePdf.isTruncated, true)
  })

  it('normalizes password and invalid PDF errors to readable pt-BR messages', () => {
    const passwordErr = Object.assign(new Error('No password given'), {
      name: 'PasswordException',
    })
    const normalizedPassword = normalizePdfJsError(passwordErr)
    assert.ok(normalizedPassword instanceof PdfOperationError)
    assert.match(normalizedPassword.message, /protegido por senha/i)

    const corruptErr = Object.assign(new Error('Invalid PDF structure'), {
      name: 'InvalidPDFException',
    })
    const normalizedCorrupt = normalizePdfJsError(corruptErr)
    assert.match(normalizedCorrupt.message, /corrompido/i)
  })
})
