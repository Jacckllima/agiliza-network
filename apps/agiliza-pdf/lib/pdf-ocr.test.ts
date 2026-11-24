import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOcrTextFilename,
  formatOcrPagesResult,
  MAX_OCR_PAGES,
  parseOcrPageSelection,
} from './pdf-ocr.ts'
import { PdfOperationError } from './pdf-operations.ts'

test('parseOcrPageSelection defaults to capped page window when empty', () => {
  assert.deepEqual(parseOcrPageSelection('', 4), [1, 2, 3, 4])
  assert.equal(parseOcrPageSelection('', 25).length, MAX_OCR_PAGES)
  assert.deepEqual(parseOcrPageSelection('2, 4-5', 10), [2, 4, 5])
})

test('parseOcrPageSelection enforces MAX_OCR_PAGES limit', () => {
  assert.throws(
    () => parseOcrPageSelection('1-12', 20),
    (error: unknown) =>
      error instanceof PdfOperationError &&
      /limitado a 10 páginas/i.test(error.message),
  )
})

test('formatOcrPagesResult combines recognized pages and computes average confidence', () => {
  const formatted = formatOcrPagesResult([
    { pageNumber: 1, text: 'Texto da página um', confidence: 92 },
    { pageNumber: 2, text: '   ', confidence: 0 },
    { pageNumber: 3, text: 'Texto da página três', confidence: 88 },
  ])

  assert.match(formatted.combinedText, /=== Página 1 \(OCR\) ===/)
  assert.match(formatted.combinedText, /Texto da página um/)
  assert.match(formatted.combinedText, /Nenhum texto reconhecido nesta página/)
  assert.equal(formatted.averageConfidence, 60)
  assert.equal(buildOcrTextFilename('scan.pdf'), 'scan-ocr.txt')
})
