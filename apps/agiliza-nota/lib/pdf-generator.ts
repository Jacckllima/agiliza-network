import { jsPDF } from 'jspdf'
import {
  calculateDeclarationTotal,
  formatBRL,
  sanitizePositiveNumber,
} from './document-formatters.ts'
import type { DeclaracaoData, ReciboData } from './document-formatters.ts'

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_X = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2

function drawFooter(doc: jsPDF, portalHost: string) {
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.3)
    doc.line(MARGIN_X, PAGE_HEIGHT - 18, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 18)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `Documento auxiliar gerado via AgilizaNota (${portalHost}). A veracidade dos dados é de responsabilidade do emitente.`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 13,
      { align: 'center' },
    )
    if (pageCount > 1) {
      doc.text(`Página ${page} de ${pageCount}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 8, {
        align: 'right',
      })
    }
  }
}

export function buildReciboPdf(data: ReciboData, portalHost: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 24

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 23, 42)
  doc.text('RECIBO DE PAGAMENTO', PAGE_WIDTH / 2, y, { align: 'center' })

  y += 7
  doc.setFontSize(11)
  doc.setTextColor(71, 85, 105)
  doc.text(`Nº ${data.numero.trim() || '0001'}`, PAGE_WIDTH / 2, y, { align: 'center' })

  y += 5
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.7)
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y)

  // Highlighted Value Box
  y += 10
  doc.setFillColor(241, 245, 249)
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 22, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.text('VALOR RECEBIDO', PAGE_WIDTH - MARGIN_X - 6, y + 7, { align: 'right' })

  doc.setFontSize(17)
  doc.setTextColor(15, 23, 42)
  doc.text(`R$ ${formatBRL(data.valor)}`, PAGE_WIDTH - MARGIN_X - 6, y + 17, { align: 'right' })

  // Body Text
  y += 34
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(30, 41, 59)

  const pagadorLabel = data.pagadorDoc.trim()
    ? `${data.pagadorNome.trim().toUpperCase()} (CPF/CNPJ: ${data.pagadorDoc.trim()})`
    : data.pagadorNome.trim().toUpperCase()

  const bodyText = `Recebi(emos) de ${pagadorLabel} a quantia de R$ ${formatBRL(data.valor)}, referente a: ${data.referente.trim()}.`
  const wrappedBody = doc.splitTextToSize(bodyText, CONTENT_WIDTH)
  doc.text(wrappedBody, MARGIN_X, y, { lineHeightFactor: 1.5 })

  y += wrappedBody.length * 7 + 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(51, 65, 85)
  doc.text('Para clareza e fins de direito, firmo(amos) o presente recibo.', MARGIN_X, y)

  // City & Date aligned right
  y += 16
  const cityLabel = data.cidade.trim() || 'Cidade / UF'
  const dateLabel = data.dataDoc.trim() || new Date().toLocaleDateString('pt-BR')
  doc.setFontSize(10.5)
  doc.setTextColor(71, 85, 105)
  doc.text(`${cityLabel}, ${dateLabel}`, PAGE_WIDTH - MARGIN_X, y, { align: 'right' })

  // Generous signature space
  y += 28
  const lineHalf = 42
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.5)
  doc.line(PAGE_WIDTH / 2 - lineHalf, y, PAGE_WIDTH / 2 + lineHalf, y)

  y += 5.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(15, 23, 42)
  doc.text(data.emissorNome.trim(), PAGE_WIDTH / 2, y, { align: 'center' })

  if (data.emissorDoc.trim()) {
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.text(data.emissorDoc.trim(), PAGE_WIDTH / 2, y, { align: 'center' })
  }

  drawFooter(doc, portalHost)
  return doc
}

export function buildDeclaracaoPdf(data: DeclaracaoData, portalHost: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 22

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text('DECLARAÇÃO DE CONTEÚDO', PAGE_WIDTH / 2, y, { align: 'center' })

  y += 5
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.7)
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y)

  // Sender & Recipient
  y += 9
  doc.setFontSize(9.5)
  doc.setTextColor(30, 41, 59)

  const remetenteLine = `REMETENTE: ${data.remetenteNome.trim()}${data.remetenteDoc.trim() ? ` (${data.remetenteDoc.trim()})` : ''} - ${data.remetenteEnd.trim()}`
  const wrappedRem = doc.splitTextToSize(remetenteLine, CONTENT_WIDTH)
  doc.setFont('helvetica', 'normal')
  doc.text(wrappedRem, MARGIN_X, y)
  y += wrappedRem.length * 5 + 3

  const destinatarioLine = `DESTINATÁRIO: ${data.destinatarioNome.trim()}${data.destinatarioDoc.trim() ? ` (${data.destinatarioDoc.trim()})` : ''} - ${data.destinatarioEnd.trim()}`
  const wrappedDest = doc.splitTextToSize(destinatarioLine, CONTENT_WIDTH)
  doc.text(wrappedDest, MARGIN_X, y)
  y += wrappedDest.length * 5 + 6

  // Table header helper
  const colDescWidth = 104
  const colQtdWidth = 18
  const colUnitWidth = 24
  const colSubWidth = CONTENT_WIDTH - colDescWidth - colQtdWidth - colUnitWidth

  const drawTableHeader = (topY: number) => {
    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.3)
    doc.rect(MARGIN_X, topY, CONTENT_WIDTH, 8, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)
    doc.text('Item / Conteúdo', MARGIN_X + 2, topY + 5.5)
    doc.text('Qtd', MARGIN_X + colDescWidth + colQtdWidth / 2, topY + 5.5, { align: 'center' })
    doc.text('Unit. (R$)', MARGIN_X + colDescWidth + colQtdWidth + colUnitWidth - 2, topY + 5.5, {
      align: 'right',
    })
    doc.text('Subtotal (R$)', PAGE_WIDTH - MARGIN_X - 2, topY + 5.5, { align: 'right' })
    return topY + 8
  }

  y = drawTableHeader(y)

  const validItems = data.itens.filter((item) => item.desc.trim().length > 0 && item.qtd > 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)

  for (const item of validItems) {
    const descLines = doc.splitTextToSize(item.desc.trim(), colDescWidth - 4)
    const rowHeight = Math.max(7, descLines.length * 4.5 + 2.5)

    if (y + rowHeight > PAGE_HEIGHT - 32) {
      doc.addPage()
      y = drawTableHeader(20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
    }

    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.25)
    doc.rect(MARGIN_X, y, CONTENT_WIDTH, rowHeight)

    const qtd = sanitizePositiveNumber(item.qtd)
    const unit = sanitizePositiveNumber(item.valor)
    const sub = sanitizePositiveNumber(qtd * unit)

    doc.setTextColor(30, 41, 59)
    doc.text(descLines, MARGIN_X + 2, y + 4.8)
    doc.text(String(qtd), MARGIN_X + colDescWidth + colQtdWidth / 2, y + 4.8, { align: 'center' })
    doc.text(formatBRL(unit), MARGIN_X + colDescWidth + colQtdWidth + colUnitWidth - 2, y + 4.8, {
      align: 'right',
    })
    doc.text(formatBRL(sub), PAGE_WIDTH - MARGIN_X - 2, y + 4.8, { align: 'right' })

    y += rowHeight
  }

  // Total Row
  const total = calculateDeclarationTotal(validItems)
  if (y + 38 > PAGE_HEIGHT - 24) {
    doc.addPage()
    y = 22
  }

  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(`TOTAL DECLARADO: R$ ${formatBRL(total)}`, PAGE_WIDTH - MARGIN_X, y, { align: 'right' })

  // City & Date + Signature
  y += 12
  const cityLabel = data.cidade.trim() || 'Cidade / UF'
  const dateLabel = data.dataDoc.trim() || new Date().toLocaleDateString('pt-BR')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(71, 85, 105)
  doc.text(`${cityLabel}, ${dateLabel}`, PAGE_WIDTH - MARGIN_X, y, { align: 'right' })

  y += 22
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.5)
  doc.line(PAGE_WIDTH / 2 - 42, y, PAGE_WIDTH / 2 + 42, y)

  y += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)
  doc.text(data.remetenteNome.trim(), PAGE_WIDTH / 2, y, { align: 'center' })

  drawFooter(doc, portalHost)
  return doc
}

export function downloadReciboPdf(data: ReciboData, portalHost: string): string {
  const safeNum = (data.numero.trim() || '0001').replace(/[^a-zA-Z0-9_-]/g, '')
  const filename = `recibo-pagamento-${safeNum || '0001'}.pdf`
  const doc = buildReciboPdf(data, portalHost)
  doc.save(filename)
  return filename
}

export function downloadDeclaracaoPdf(data: DeclaracaoData, portalHost: string): string {
  const filename = 'declaracao-conteudo.pdf'
  const doc = buildDeclaracaoPdf(data, portalHost)
  doc.save(filename)
  return filename
}
