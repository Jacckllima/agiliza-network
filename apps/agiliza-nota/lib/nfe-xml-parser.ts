import { formatAccessKey } from './nfe-key.ts'

export const MAX_NFE_XML_BYTES = 5 * 1024 * 1024 // 5 MB

export interface NfeAddress {
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  telefone: string
}

export interface NfeParty {
  nome: string
  fantasia?: string
  documento: string
  ie: string
  endereco: NfeAddress
}

export interface NfeItem {
  numero: number
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

export interface NfeTotals {
  vBC: number
  vICMS: number
  vProd: number
  vFrete: number
  vSeg: number
  vDesc: number
  vIPI: number
  vNF: number
  vTotTrib: number
}

export interface NfeProtocol {
  numero: string
  dataRecebimento: string
  codigoStatus: string
  motivo: string
}

export interface NfeParsedData {
  accessKey: string
  formattedKey: string
  hasProtocol: boolean
  protocolo?: NfeProtocol
  identificacao: {
    natOp: string
    modelo: string
    serie: string
    numero: string
    dataEmissao: string
    tipoOperacao: '0' | '1'
    ambiente: '1' | '2'
  }
  emitente: NfeParty
  destinatario: NfeParty
  itens: NfeItem[]
  totais: NfeTotals
  transporte: {
    modFrete: string
    transportadoraNome: string
    transportadoraDoc: string
  }
  informacoesComplementares: string
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}

function getSection(xml: string, tag: string): string {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'i')
  const match = regex.exec(xml)
  return match?.[1] ?? ''
}

function getAllSections(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'gi')
  const results: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml)) !== null) {
    if (match[1] !== undefined) {
      results.push(match[1])
    }
  }
  return results
}

function getTagText(xml: string, tag: string): string {
  return decodeXmlEntities(getSection(xml, tag))
}

function parseNumber(raw: string): number {
  const num = Number(raw.replace(',', '.'))
  return Number.isFinite(num) ? num : 0
}

function formatDocument(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  return raw
}

function formatIsoDateBR(raw: string): string {
  if (!raw) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}:\d{2}))?/.exec(raw.trim())
  if (!match) return raw
  const [, yyyy, mm, dd, time] = match
  return time ? `${dd}/${mm}/${yyyy} ${time}` : `${dd}/${mm}/${yyyy}`
}

function parseAddress(xml: string): NfeAddress {
  return {
    logradouro: getTagText(xml, 'xLgr'),
    numero: getTagText(xml, 'nro'),
    bairro: getTagText(xml, 'xBairro'),
    municipio: getTagText(xml, 'xMun'),
    uf: getTagText(xml, 'UF'),
    cep: getTagText(xml, 'CEP').replace(/^(\d{5})(\d{3})$/, '$1-$2'),
    telefone: getTagText(xml, 'fone'),
  }
}

export function parseNfeXml(xmlText: string): NfeParsedData {
  const trimmed = xmlText.trim()
  if (!trimmed || !trimmed.startsWith('<')) {
    throw new Error('O arquivo enviado não contém um XML válido.')
  }

  // Validação estrutural no browser quando DOMParser estiver disponível
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(trimmed, 'application/xml')
    if (doc.querySelector('parsererror')) {
      throw new Error('XML malformado ou corrompido. Verifique se o arquivo está íntegro.')
    }
  }

  const infNFeMatch = /<(?:[a-zA-Z0-9_-]+:)?infNFe([^>]*)>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?infNFe>/i.exec(trimmed)
  if (!infNFeMatch) {
    throw new Error('O XML não corresponde a uma NF-e ou NFC-e válida (tag <infNFe> não encontrada).')
  }

  const infNFeAttrs = infNFeMatch[1] ?? ''
  const infNFeBody = infNFeMatch[2] ?? ''

  const idAttrMatch = /Id=["'](?:NFe)?(\d{44})["']/i.exec(infNFeAttrs)
  const protNFeSection = getSection(trimmed, 'protNFe')
  const infProtSection = getSection(protNFeSection, 'infProt')
  const protChave = getTagText(infProtSection, 'chNFe')

  const accessKey = (idAttrMatch?.[1] || protChave || '').replace(/\D/g, '')
  if (accessKey.length !== 44) {
    throw new Error('Não foi possível identificar a chave de acesso de 44 dígitos no XML.')
  }

  const ideSection = getSection(infNFeBody, 'ide')
  const emitSection = getSection(infNFeBody, 'emit')
  const destSection = getSection(infNFeBody, 'dest')
  const totalSection = getSection(infNFeBody, 'ICMSTot')
  const transpSection = getSection(infNFeBody, 'transp')
  const transportaSection = getSection(transpSection, 'transporta')
  const infAdicSection = getSection(infNFeBody, 'infAdic')

  const detSections = getAllSections(infNFeBody, 'det')
  const itens: NfeItem[] = detSections.map((detXml, index) => {
    const prodXml = getSection(detXml, 'prod')
    return {
      numero: index + 1,
      codigo: getTagText(prodXml, 'cProd'),
      descricao: getTagText(prodXml, 'xProd'),
      ncm: getTagText(prodXml, 'NCM'),
      cfop: getTagText(prodXml, 'CFOP'),
      unidade: getTagText(prodXml, 'uCom'),
      quantidade: parseNumber(getTagText(prodXml, 'qCom')),
      valorUnitario: parseNumber(getTagText(prodXml, 'vUnCom')),
      valorTotal: parseNumber(getTagText(prodXml, 'vProd')),
    }
  })

  if (itens.length === 0) {
    throw new Error('O XML da NF-e não possui itens (<det>) válidos.')
  }

  const hasProtocol = Boolean(infProtSection && getTagText(infProtSection, 'nProt'))
  const protocolo: NfeProtocol | undefined = hasProtocol
    ? {
        numero: getTagText(infProtSection, 'nProt'),
        dataRecebimento: formatIsoDateBR(getTagText(infProtSection, 'dhRecbto')),
        codigoStatus: getTagText(infProtSection, 'cStat'),
        motivo: getTagText(infProtSection, 'xMotivo'),
      }
    : undefined

  const tpNF = getTagText(ideSection, 'tpNF') === '0' ? '0' : '1'
  const tpAmb = getTagText(ideSection, 'tpAmb') === '2' ? '2' : '1'

  return {
    accessKey,
    formattedKey: formatAccessKey(accessKey),
    hasProtocol,
    protocolo,
    identificacao: {
      natOp: getTagText(ideSection, 'natOp'),
      modelo: getTagText(ideSection, 'mod') || accessKey.slice(20, 22),
      serie: getTagText(ideSection, 'serie') || String(Number(accessKey.slice(22, 25))),
      numero: getTagText(ideSection, 'nNF') || String(Number(accessKey.slice(25, 34))),
      dataEmissao: formatIsoDateBR(getTagText(ideSection, 'dhEmi') || getTagText(ideSection, 'dEmi')),
      tipoOperacao: tpNF,
      ambiente: tpAmb,
    },
    emitente: {
      nome: getTagText(emitSection, 'xNome'),
      fantasia: getTagText(emitSection, 'xFant') || undefined,
      documento: formatDocument(getTagText(emitSection, 'CNPJ') || getTagText(emitSection, 'CPF')),
      ie: getTagText(emitSection, 'IE'),
      endereco: parseAddress(getSection(emitSection, 'enderEmit')),
    },
    destinatario: {
      nome: getTagText(destSection, 'xNome') || 'Consumidor não identificado',
      documento: formatDocument(getTagText(destSection, 'CNPJ') || getTagText(destSection, 'CPF')),
      ie: getTagText(destSection, 'IE'),
      endereco: parseAddress(getSection(destSection, 'enderDest')),
    },
    itens,
    totais: {
      vBC: parseNumber(getTagText(totalSection, 'vBC')),
      vICMS: parseNumber(getTagText(totalSection, 'vICMS')),
      vProd: parseNumber(getTagText(totalSection, 'vProd')),
      vFrete: parseNumber(getTagText(totalSection, 'vFrete')),
      vSeg: parseNumber(getTagText(totalSection, 'vSeg')),
      vDesc: parseNumber(getTagText(totalSection, 'vDesc')),
      vIPI: parseNumber(getTagText(totalSection, 'vIPI')),
      vNF: parseNumber(getTagText(totalSection, 'vNF')),
      vTotTrib: parseNumber(getTagText(totalSection, 'vTotTrib')),
    },
    transporte: {
      modFrete: getTagText(transpSection, 'modFrete') || '9',
      transportadoraNome: getTagText(transportaSection, 'xNome'),
      transportadoraDoc: formatDocument(
        getTagText(transportaSection, 'CNPJ') || getTagText(transportaSection, 'CPF'),
      ),
    },
    informacoesComplementares: getTagText(infAdicSection, 'infCpl'),
  }
}
