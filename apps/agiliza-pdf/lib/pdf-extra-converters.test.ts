import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  buildMarkdownFilename,
  convertCsvToPdf,
  convertHtmlToPdf,
  detectCsvDelimiter,
  formatPagesAsMarkdown,
  parseCsvTable,
  parseHtmlToBlocks,
} from './pdf-extra-converters.ts'
import { PdfOperationError } from './pdf-operations.ts'

test('detectCsvDelimiter and parseCsvTable handle semicolon, comma and quoted cells', () => {
  const brCsv = 'Produto;Preço;Observação\n"Caderno; Grande";25,90;"Linha ""especial"""\nCaneta;4,50;Azul'
  assert.equal(detectCsvDelimiter(brCsv), ';')

  const rows = parseCsvTable(brCsv, 'auto')
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0], ['Produto', 'Preço', 'Observação'])
  assert.deepEqual(rows[1], ['Caderno; Grande', '25,90', 'Linha "especial"'])
  assert.deepEqual(rows[2], ['Caneta', '4,50', 'Azul'])
})

test('convertCsvToPdf generates valid paginated A4 PDF', async () => {
  const lines = ['Nome,Cargo,Cidade']
  for (let i = 1; i <= 45; i += 1) {
    lines.push(`Pessoa ${i},Analista ${i},São Paulo`)
  }

  const result = await convertCsvToPdf(lines.join('\n'), {
    title: 'Relatório de Equipe',
  })
  assert.ok(result.pageCount >= 2)

  const doc = await PDFDocument.load(result.bytes)
  assert.equal(doc.getPageCount(), result.pageCount)
})

test('convertCsvToPdf rejects empty CSV', async () => {
  await assert.rejects(
    () => convertCsvToPdf('   \n  '),
    (error: unknown) =>
      error instanceof PdfOperationError && /CSV/i.test(error.message),
  )
})

test('parseHtmlToBlocks extracts headings, lists, code and strips scripts/styles', () => {
  const html = `
    <html>
      <head><style>body { color: red; }</style></head>
      <body>
        <script>alert("xss")</script>
        <h1>Título Principal</h1>
        <p>Parágrafo com &aacute;centua&ccedil;&atilde;o.</p>
        <ul><li>Item um</li><li>Item dois</li></ul>
        <pre>const x = 1;</pre>
        <hr />
      </body>
    </html>
  `
  const blocks = parseHtmlToBlocks(html)
  assert.equal(blocks.length, 6)
  assert.equal(blocks[0]?.type, 'heading')
  assert.equal(blocks[0]?.level, 1)
  assert.equal(blocks[1]?.text, 'Parágrafo com ácentuação.')
  assert.equal(blocks[2]?.type, 'list-item')
  assert.equal(blocks[4]?.type, 'code')
  assert.equal(blocks[5]?.type, 'hr')
})

test('convertHtmlToPdf produces valid PDF and rejects empty HTML', async () => {
  const result = await convertHtmlToPdf(
    '<h1>Proposta Comercial</h1><p>Detalhes do projeto em português.</p><ul><li>Prazo: 10 dias</li></ul>',
    { title: 'Proposta' },
  )
  assert.equal(result.pageCount, 1)
  const doc = await PDFDocument.load(result.bytes)
  assert.equal(doc.getPageCount(), 1)

  await assert.rejects(
    () => convertHtmlToPdf('<script>only()</script>'),
    (error: unknown) =>
      error instanceof PdfOperationError && /HTML/i.test(error.message),
  )
})

test('formatPagesAsMarkdown structures headings, lists and page breaks', () => {
  const formatted = formatPagesAsMarkdown([
    {
      pageNumber: 1,
      lines: [
        { text: 'Relatório Anual', fontSize: 20, y: 780 },
        { text: 'Resumo executivo', fontSize: 15, y: 740 },
        { text: 'Texto normal do parágrafo.', fontSize: 11, y: 700 },
        { text: '• Primeiro item da lista', fontSize: 11, y: 680 },
        { text: '1) Passo numerado', fontSize: 11, y: 660 },
      ],
    },
  ])

  assert.equal(formatted.hasSelectableText, true)
  assert.match(formatted.markdown, /# Relatório Anual/)
  assert.match(formatted.markdown, /## Resumo executivo/)
  assert.match(formatted.markdown, /- Primeiro item da lista/)
  assert.match(formatted.markdown, /1\. Passo numerado/)
  assert.equal(buildMarkdownFilename('Contrato.pdf'), 'Contrato.md')
})

test('formatPagesAsMarkdown detects scanned PDF without text', () => {
  const empty = formatPagesAsMarkdown([{ pageNumber: 1, lines: [] }])
  assert.equal(empty.hasSelectableText, false)
  assert.equal(empty.markdown, '')
})
