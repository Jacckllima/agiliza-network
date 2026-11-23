import { jsPDF } from 'jspdf'
import { encodeCode128C } from './code128c.ts'
import { formatBRL } from './document-formatters.ts'
import type { NfeParsedData } from './nfe-xml-parser.ts'

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 10
const CONTENT_W = PAGE_W - MARGIN * 2

const FRETE_LABELS: Record<string, string> = {
  '0': '0 - Por conta do Remetente (CIF)',
  '1': '1 - Por conta do Destinatário (FOB)',
  '2': '2 - Por conta de Terceiros',
  '3': '3 - Transporte Próprio Remetente',
  '4': '4 - Transporte Próprio Destinatário',
  '9': '9 - Sem Ocorrência de Transporte',
}

function drawLabeledBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  options: { align?: 'left' | 'right' | 'center'; bold?: boolean; valueSize?: number } = {},
) {
  const { align = 'left', bold = false, valueSize = 8 } = options
  doc.setDrawColor(51, 65, 85)
  doc.setLineWidth(0.25)
  doc.rect(x, y, w, h)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(71, 85, 105)
  doc.text(label.toUpperCase(), x + 1.5, y + 3)

  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(valueSize)
  doc.setTextColor(15, 23, 42)
  const textX = align === 'right' ? x + w - 1.5 : align === 'center' ? x + w / 2 : x + 1.5
  const maxW = Math.max(4, w - 3)
  const truncated = doc.splitTextToSize(value || '-', maxW)[0] ?? ''
  doc.text(truncated, textX, y + h - 2, { align })
}

function drawCode128Barcode(
  doc: jsPDF,
  accessKey: string,
  x: number,
  y: number,
  maxWidth: number,
  height: number,
) {
  const encoded = encodeCode128C(accessKey)
  const quietZoneModules = 10
  const moduleWidth = maxWidth / (encoded.totalModules + quietZoneModules * 2)
  let cursorX = x + quietZoneModules * moduleWidth

  doc.setFillColor(15, 23, 42)
  for (let i = 0; i < encoded.modules.length; i += 1) {
    const w = encoded.modules[i]! * moduleWidth
    if (i % 2 === 0) {
      doc.rect(cursorX, y, w, height, 'F')
    }
    cursorX += w
  }
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(15, 23, 42)
  doc.text(title.toUpperCase(), MARGIN, y)
  return y + 1.8
}

function drawDanfeFooter(doc: jsPDF, portalHost: string) {
  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.25)
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `Representação gráfica auxiliar (DANFE) gerada via AgilizaNota (${portalHost}). Não substitui o arquivo XML fiscal oficial.`,
      MARGIN,
      PAGE_H - 8,
    )
    doc.text(`Folha ${page}/${totalPages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' })
  }
}

export function buildDanfePdf(nfe: NfeParsedData, portalHost: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = MARGIN

  // 1. Canhoto
  const canhotoLeftW = CONTENT_W - 36
  doc.setDrawColor(51, 65, 85)
  doc.setLineWidth(0.25)
  doc.rect(MARGIN, y, canhotoLeftW, 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(30, 41, 59)
  const canhotoMsg = `RECEBEMOS DE ${nfe.emitente.nome || 'EMITENTE'} OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO`
  doc.text(doc.splitTextToSize(canhotoMsg, canhotoLeftW - 3), MARGIN + 1.5, y + 3)

  drawLabeledBox(doc, MARGIN, y + 8, 42, 9, 'Data de Recebimento', '')
  drawLabeledBox(doc, MARGIN + 42, y + 8, canhotoLeftW - 42, 9, 'Identificação e Assinatura do Recebedor', '')

  // Box NF-e no canhoto
  doc.rect(MARGIN + canhotoLeftW, y, 36, 17)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(15, 23, 42)
  doc.text('NF-e', MARGIN + canhotoLeftW + 18, y + 5, { align: 'center' })
  doc.setFontSize(7.5)
  doc.text(`Nº ${nfe.identificacao.numero}`, MARGIN + canhotoLeftW + 18, y + 10, { align: 'center' })
  doc.text(`SÉRIE ${nfe.identificacao.serie}`, MARGIN + canhotoLeftW + 18, y + 14.5, { align: 'center' })

  y += 19.5
  doc.setDrawColor(148, 163, 184)
  doc.setLineDashPattern([1.5, 1.5], 0)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  doc.setLineDashPattern([], 0)
  y += 2.5

  // 2. Cabeçalho DANFE (3 colunas)
  const headerH = 34
  const colEmitW = 74
  const colDanfeW = 34
  const colBarcodeW = CONTENT_W - colEmitW - colDanfeW

  // Coluna 1: Emitente
  doc.setDrawColor(51, 65, 85)
  doc.setLineWidth(0.25)
  doc.rect(MARGIN, y, colEmitW, headerH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(15, 23, 42)
  const emitNameLines = doc.splitTextToSize(nfe.emitente.nome || 'EMITENTE', colEmitW - 4)
  doc.text(emitNameLines.slice(0, 2), MARGIN + 2, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(51, 65, 85)
  const emitAddr = [
    `${nfe.emitente.endereco.logradouro}${nfe.emitente.endereco.numero ? `, ${nfe.emitente.endereco.numero}` : ''}`,
    nfe.emitente.endereco.bairro,
    `${nfe.emitente.endereco.municipio}${nfe.emitente.endereco.uf ? ` / ${nfe.emitente.endereco.uf}` : ''}`,
    nfe.emitente.endereco.cep ? `CEP: ${nfe.emitente.endereco.cep}` : '',
    nfe.emitente.endereco.telefone ? `Fone: ${nfe.emitente.endereco.telefone}` : '',
  ]
    .filter(Boolean)
    .join(' - ')
  const emitAddrLines = doc.splitTextToSize(emitAddr, colEmitW - 4)
  doc.text(emitAddrLines.slice(0, 4), MARGIN + 2, y + 15)

  // Coluna 2: DANFE
  const danfeX = MARGIN + colEmitW
  doc.rect(danfeX, y, colDanfeW, headerH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text('DANFE', danfeX + colDanfeW / 2, y + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.text('Documento Auxiliar da', danfeX + colDanfeW / 2, y + 9.5, { align: 'center' })
  doc.text('Nota Fiscal Eletrônica', danfeX + colDanfeW / 2, y + 12, { align: 'center' })

  doc.setFontSize(6)
  doc.text('0 - ENTRADA', danfeX + 2, y + 17)
  doc.text('1 - SAÍDA', danfeX + 2, y + 20)
  doc.rect(danfeX + colDanfeW - 9, y + 15, 6.5, 6.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(nfe.identificacao.tipoOperacao, danfeX + colDanfeW - 5.75, y + 19.7, { align: 'center' })

  doc.setFontSize(7.5)
  doc.text(`Nº ${nfe.identificacao.numero}`, danfeX + colDanfeW / 2, y + 26.5, { align: 'center' })
  doc.text(`SÉRIE ${nfe.identificacao.serie}`, danfeX + colDanfeW / 2, y + 30.5, { align: 'center' })

  // Coluna 3: Código de Barras + Chave de Acesso
  const barcodeX = danfeX + colDanfeW
  doc.rect(barcodeX, y, colBarcodeW, headerH)
  drawCode128Barcode(doc, nfe.accessKey, barcodeX + 2, y + 3, colBarcodeW - 4, 12)

  doc.setDrawColor(51, 65, 85)
  doc.line(barcodeX, y + 17, barcodeX + colBarcodeW, y + 17)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(71, 85, 105)
  doc.text('CHAVE DE ACESSO', barcodeX + 1.5, y + 19.8)

  doc.setFont('courier', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(15, 23, 42)
  const keyLines = doc.splitTextToSize(nfe.formattedKey, colBarcodeW - 3)
  doc.text(keyLines, barcodeX + colBarcodeW / 2, y + 23.2, { align: 'center' })

  doc.line(barcodeX, y + 28, barcodeX + colBarcodeW, y + 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.2)
  doc.setTextColor(71, 85, 105)
  doc.text(
    'Consulta de autenticidade no portal nacional da NF-e (www.nfe.fazenda.gov.br)',
    barcodeX + colBarcodeW / 2,
    y + 31.8,
    { align: 'center' },
  )

  y += headerH

  // Linha Natureza da Operação + Protocolo
  const natW = 108
  drawLabeledBox(doc, MARGIN, y, natW, 9, 'Natureza da Operação', nfe.identificacao.natOp, { valueSize: 7.5 })
  const protLabel = nfe.hasProtocol
    ? `${nfe.protocolo?.numero ?? ''} - ${nfe.protocolo?.dataRecebimento ?? ''}`
    : 'SEM PROTOCOLO DE AUTORIZAÇÃO (CONFERÊNCIA)'
  drawLabeledBox(doc, MARGIN + natW, y, CONTENT_W - natW, 9, 'Protocolo de Autorização de Uso', protLabel, {
    bold: !nfe.hasProtocol,
    valueSize: 7,
  })
  y += 9

  // IE + CNPJ Emitente
  drawLabeledBox(doc, MARGIN, y, CONTENT_W / 2, 9, 'Inscrição Estadual', nfe.emitente.ie || 'ISENTO')
  drawLabeledBox(doc, MARGIN + CONTENT_W / 2, y, CONTENT_W / 2, 9, 'CNPJ / CPF do Emitente', nfe.emitente.documento, {
    bold: true,
  })
  y += 12

  // 3. Destinatário / Remetente
  y = drawSectionTitle(doc, y, 'Destinatário / Remetente')
  drawLabeledBox(doc, MARGIN, y, 112, 9, 'Nome / Razão Social', nfe.destinatario.nome, { bold: true })
  drawLabeledBox(doc, MARGIN + 112, y, 42, 9, 'CNPJ / CPF', nfe.destinatario.documento)
  drawLabeledBox(doc, MARGIN + 154, y, CONTENT_W - 154, 9, 'Data da Emissão', nfe.identificacao.dataEmissao, {
    valueSize: 7,
  })
  y += 9

  const destAddr = `${nfe.destinatario.endereco.logradouro}${nfe.destinatario.endereco.numero ? `, ${nfe.destinatario.endereco.numero}` : ''}`
  drawLabeledBox(doc, MARGIN, y, 96, 9, 'Endereço', destAddr)
  drawLabeledBox(doc, MARGIN + 96, y, 46, 9, 'Bairro / Distrito', nfe.destinatario.endereco.bairro)
  drawLabeledBox(doc, MARGIN + 142, y, CONTENT_W - 142, 9, 'CEP', nfe.destinatario.endereco.cep)
  y += 9

  drawLabeledBox(doc, MARGIN, y, 96, 9, 'Município', nfe.destinatario.endereco.municipio)
  drawLabeledBox(doc, MARGIN + 96, y, 18, 9, 'UF', nfe.destinatario.endereco.uf, { align: 'center' })
  drawLabeledBox(doc, MARGIN + 114, y, CONTENT_W - 114, 9, 'Inscrição Estadual', nfe.destinatario.ie || '-')
  y += 12

  // 4. Cálculo do Imposto
  y = drawSectionTitle(doc, y, 'Cálculo do Imposto')
  const taxColW = CONTENT_W / 4
  drawLabeledBox(doc, MARGIN, y, taxColW, 9, 'Base de Cálc. ICMS', formatBRL(nfe.totais.vBC), { align: 'right' })
  drawLabeledBox(doc, MARGIN + taxColW, y, taxColW, 9, 'Valor do ICMS', formatBRL(nfe.totais.vICMS), { align: 'right' })
  drawLabeledBox(doc, MARGIN + taxColW * 2, y, taxColW, 9, 'Valor do IPI', formatBRL(nfe.totais.vIPI), { align: 'right' })
  drawLabeledBox(doc, MARGIN + taxColW * 3, y, taxColW, 9, 'Valor Total dos Produtos', formatBRL(nfe.totais.vProd), {
    align: 'right',
    bold: true,
  })
  y += 9

  drawLabeledBox(doc, MARGIN, y, taxColW, 9, 'Valor do Frete', formatBRL(nfe.totais.vFrete), { align: 'right' })
  drawLabeledBox(doc, MARGIN + taxColW, y, taxColW, 9, 'Valor do Seguro', formatBRL(nfe.totais.vSeg), { align: 'right' })
  drawLabeledBox(doc, MARGIN + taxColW * 2, y, taxColW, 9, 'Desconto', formatBRL(nfe.totais.vDesc), { align: 'right' })
  drawLabeledBox(doc, MARGIN + taxColW * 3, y, taxColW, 9, 'Valor Total da Nota', `R$ ${formatBRL(nfe.totais.vNF)}`, {
    align: 'right',
    bold: true,
    valueSize: 8.5,
  })
  y += 12

  // 5. Transportador
  y = drawSectionTitle(doc, y, 'Transportador / Volumes Transportados')
  drawLabeledBox(
    doc,
    MARGIN,
    y,
    82,
    9,
    'Razão Social',
    nfe.transporte.transportadoraNome || 'Não informado',
  )
  drawLabeledBox(
    doc,
    MARGIN + 82,
    y,
    64,
    9,
    'Frete por Conta',
    FRETE_LABELS[nfe.transporte.modFrete] ?? nfe.transporte.modFrete,
    { valueSize: 7 },
  )
  drawLabeledBox(doc, MARGIN + 146, y, CONTENT_W - 146, 9, 'CNPJ / CPF', nfe.transporte.transportadoraDoc || '-')
  y += 12

  // 6. Produtos / Serviços (com paginação automática)
  y = drawSectionTitle(doc, y, 'Dados dos Produtos / Serviços')
  const cols = {
    cod: 20,
    desc: 78,
    ncm: 16,
    cfop: 11,
    un: 10,
    qtd: 15,
    unit: 20,
    total: CONTENT_W - (20 + 78 + 16 + 11 + 10 + 15 + 20),
  }

  const drawItemsHeader = (topY: number): number => {
    doc.setFillColor(241, 245, 249)
    doc.setDrawColor(51, 65, 85)
    doc.setLineWidth(0.25)
    doc.rect(MARGIN, topY, CONTENT_W, 6.5, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(15, 23, 42)
    let cx = MARGIN
    doc.text('CÓD.', cx + 1, topY + 4.3)
    cx += cols.cod
    doc.text('DESCRIÇÃO DO PRODUTO / SERVIÇO', cx + 1, topY + 4.3)
    cx += cols.desc
    doc.text('NCM', cx + cols.ncm / 2, topY + 4.3, { align: 'center' })
    cx += cols.ncm
    doc.text('CFOP', cx + cols.cfop / 2, topY + 4.3, { align: 'center' })
    cx += cols.cfop
    doc.text('UN', cx + cols.un / 2, topY + 4.3, { align: 'center' })
    cx += cols.un
    doc.text('QTD', cx + cols.qtd - 1, topY + 4.3, { align: 'right' })
    cx += cols.qtd
    doc.text('V. UNIT.', cx + cols.unit - 1, topY + 4.3, { align: 'right' })
    cx += cols.unit
    doc.text('V. TOTAL', cx + cols.total - 1, topY + 4.3, { align: 'right' })
    return topY + 6.5
  }

  y = drawItemsHeader(y)

  for (const item of nfe.itens) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    const descLines = doc.splitTextToSize(item.descricao || '-', cols.desc - 2)
    const rowH = Math.max(5.8, descLines.length * 3.3 + 2)

    if (y + rowH > PAGE_H - 22) {
      doc.addPage()
      y = drawSectionTitle(doc, MARGIN + 2, `Dados dos Produtos / Serviços (Continuação - NF-e Nº ${nfe.identificacao.numero})`)
      y = drawItemsHeader(y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
    }

    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.2)
    doc.rect(MARGIN, y, CONTENT_W, rowH)

    doc.setTextColor(15, 23, 42)
    let cx = MARGIN
    doc.text((item.codigo || '-').slice(0, 12), cx + 1, y + 3.8)
    cx += cols.cod
    doc.text(descLines, cx + 1, y + 3.8)
    cx += cols.desc
    doc.text(item.ncm || '-', cx + cols.ncm / 2, y + 3.8, { align: 'center' })
    cx += cols.ncm
    doc.text(item.cfop || '-', cx + cols.cfop / 2, y + 3.8, { align: 'center' })
    cx += cols.cfop
    doc.text(item.unidade || '-', cx + cols.un / 2, y + 3.8, { align: 'center' })
    cx += cols.un
    doc.text(String(item.quantidade), cx + cols.qtd - 1, y + 3.8, { align: 'right' })
    cx += cols.qtd
    doc.text(formatBRL(item.valorUnitario), cx + cols.unit - 1, y + 3.8, { align: 'right' })
    cx += cols.unit
    doc.text(formatBRL(item.valorTotal), cx + cols.total - 1, y + 3.8, { align: 'right' })

    y += rowH
  }

  // 7. Dados Adicionais
  const infCpl = nfe.informacoesComplementares.trim()
  if (infCpl) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    const infoLines = doc.splitTextToSize(infCpl, CONTENT_W - 4)
    const boxH = Math.max(14, infoLines.length * 3.5 + 6)

    if (y + boxH + 6 > PAGE_H - 16) {
      doc.addPage()
      y = MARGIN + 2
    } else {
      y += 4
    }

    y = drawSectionTitle(doc, y, 'Dados Adicionais / Informações Complementares')
    doc.setDrawColor(51, 65, 85)
    doc.setLineWidth(0.25)
    doc.rect(MARGIN, y, CONTENT_W, boxH)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(30, 41, 59)
    doc.text(infoLines, MARGIN + 2, y + 4.5)
  }

  drawDanfeFooter(doc, portalHost)
  return doc
}

export function downloadDanfePdf(nfe: NfeParsedData, portalHost: string): string {
  const safeNum = (nfe.identificacao.numero || nfe.accessKey.slice(25, 34)).replace(/[^a-zA-Z0-9_-]/g, '')
  const filename = `danfe-nfe-${safeNum || 'nota'}.pdf`
  const doc = buildDanfePdf(nfe, portalHost)
  doc.save(filename)
  return filename
}
