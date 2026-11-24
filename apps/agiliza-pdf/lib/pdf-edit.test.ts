import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  addPageNumbersToPdf,
  addWatermarkToPdf,
  applyVisualRedactionToPdf,
  compareExtractedPages,
  cropPdfMargins,
  fillPdfFormFields,
  flattenPdfForm,
  inspectPdfFormFields,
} from './pdf-edit.ts'
import { PdfOperationError } from './pdf-operations.ts'

async function createSyntheticPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage([595, 842])
  }
  return doc.save()
}

async function createSyntheticFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const form = doc.getForm()

  const nameField = form.createTextField('nome_completo')
  nameField.setText('Inicial')
  nameField.addToPage(page, { x: 50, y: 700, width: 200, height: 24 })

  const acceptBox = form.createCheckBox('aceito_termos')
  acceptBox.addToPage(page, { x: 50, y: 650, width: 18, height: 18 })

  const roleDrop = form.createDropdown('perfil')
  roleDrop.addOptions(['Cliente', 'Fornecedor'])
  roleDrop.addToPage(page, { x: 50, y: 600, width: 150, height: 24 })

  return doc.save()
}

describe('pdf-edit', () => {
  it('adds page numbers to all pages', async () => {
    const pdf = await createSyntheticPdf(3)
    const numbered = await addPageNumbersToPdf(pdf, {
      position: 'bottom-center',
      format: 'of-total',
      startNumber: 1,
    })

    assert.equal(numbered.pageCount, 3)
    assert.ok(numbered.bytes.byteLength > pdf.byteLength)
  })

  it('adds text watermark and rejects empty watermark', async () => {
    const pdf = await createSyntheticPdf(2)
    const marked = await addWatermarkToPdf(pdf, {
      text: 'CONFIDENCIAL',
      opacity: 0.35,
      rotation: -35,
    })

    assert.equal(marked.pageCount, 2)
    assert.ok(marked.bytes.byteLength > pdf.byteLength)

    await assert.rejects(
      () => addWatermarkToPdf(pdf, { text: '   ', opacity: 0.4, rotation: 0 }),
      PdfOperationError,
    )
  })

  it('crops page margins and rejects excessive crop margins', async () => {
    const pdf = await createSyntheticPdf(2)
    const cropped = await cropPdfMargins(pdf, {
      top: 40,
      right: 30,
      bottom: 40,
      left: 30,
    })

    const loaded = await PDFDocument.load(cropped.bytes)
    const box = loaded.getPage(0).getCropBox()
    assert.equal(Math.round(box.width), 595 - 60)
    assert.equal(Math.round(box.height), 842 - 80)

    await assert.rejects(
      () => cropPdfMargins(pdf, { top: 500, right: 0, bottom: 400, left: 0 }),
      PdfOperationError,
    )
  })

  it('inspects, fills and flattens AcroForm fields', async () => {
    const formPdf = await createSyntheticFormPdf()
    const inspected = await inspectPdfFormFields(formPdf)

    assert.equal(inspected.fields.length, 3)
    assert.equal(inspected.fields[0]?.name, 'nome_completo')

    const filled = await fillPdfFormFields(
      formPdf,
      {
        nome_completo: 'João Silva',
        aceito_termos: true,
        perfil: 'Cliente',
      },
      false,
    )

    const afterFill = await inspectPdfFormFields(filled.bytes)
    assert.equal(afterFill.fields[0]?.value, 'João Silva')
    assert.equal(afterFill.fields[1]?.value, true)
    assert.equal(afterFill.fields[2]?.value, 'Cliente')

    const flattened = await flattenPdfForm(filled.bytes)
    assert.equal(flattened.flattenedFields, 3)

    const afterFlatten = await inspectPdfFormFields(flattened.bytes)
    assert.equal(afterFlatten.fields.length, 0)
  })

  it('applies opaque redaction box onto selected page', async () => {
    const pdf = await createSyntheticPdf(1)
    const redacted = await applyVisualRedactionToPdf(pdf, [
      { pageNumber: 1, xPercent: 10, yPercent: 20, widthPercent: 40, heightPercent: 10 },
    ])

    assert.equal(redacted.pageCount, 1)
    assert.ok(redacted.bytes.byteLength > pdf.byteLength)
  })

  it('compares extracted text pages and detects equal, modified and extra pages', () => {
    const result = compareExtractedPages(
      [
        { pageNumber: 1, text: 'Texto igual' },
        { pageNumber: 2, text: 'Versão antiga' },
      ],
      [
        { pageNumber: 1, text: '  Texto   igual ' },
        { pageNumber: 2, text: 'Versão nova' },
        { pageNumber: 3, text: 'Página extra' },
      ],
    )

    assert.equal(result.totalCompared, 3)
    assert.equal(result.equalCount, 1)
    assert.equal(result.modifiedCount, 2)
    assert.equal(result.diffs[0]?.status, 'equal')
    assert.equal(result.diffs[1]?.status, 'modified')
    assert.equal(result.diffs[2]?.status, 'only-b')
  })
})
