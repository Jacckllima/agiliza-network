import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { encodeCode128C } from './code128c.ts'
import { buildDanfePdf } from './danfe-pdf.ts'
import { computeAccessKeyCheckDigit } from './nfe-key.ts'
import type { NfeParsedData } from './nfe-xml-parser.ts'

function makeSyntheticKey(): string {
  const first43 = '3526111234567800019555001000000123112345678'
  return `${first43}${computeAccessKeyCheckDigit(first43)}`
}

function makeSyntheticNfe(itemCount = 2, withProtocol = true): NfeParsedData {
  const accessKey = makeSyntheticKey()
  const itens = Array.from({ length: itemCount }, (_, idx) => ({
    numero: idx + 1,
    codigo: `SKU-${String(idx + 1).padStart(3, '0')}`,
    descricao: `Produto sintético de teste #${idx + 1} com acentuação: ç, á, õ`,
    ncm: '84713012',
    cfop: '5102',
    unidade: 'UN',
    quantidade: 2,
    valorUnitario: 50,
    valorTotal: 100,
  }))

  return {
    accessKey,
    formattedKey: accessKey.replace(/(\d{4})(?=\d)/g, '$1 '),
    hasProtocol: withProtocol,
    protocolo: withProtocol
      ? {
          numero: '135260000123456',
          dataRecebimento: '23/11/2026 14:35:00',
          codigoStatus: '100',
          motivo: 'Autorizado o uso da NF-e',
        }
      : undefined,
    identificacao: {
      natOp: 'VENDA DE MERCADORIA',
      modelo: '55',
      serie: '1',
      numero: '123',
      dataEmissao: '23/11/2026 14:30:00',
      tipoOperacao: '1',
      ambiente: '1',
    },
    emitente: {
      nome: 'EMPRESA SINTETICA DE TESTE LTDA',
      documento: '12.345.678/0001-95',
      ie: '123456789012',
      endereco: {
        logradouro: 'RUA MODELO',
        numero: '100',
        bairro: 'CENTRO',
        municipio: 'SAO PAULO',
        uf: 'SP',
        cep: '01001-000',
        telefone: '11999990000',
      },
    },
    destinatario: {
      nome: 'CLIENTE SINTETICO DE TESTE',
      documento: '123.456.789-01',
      ie: '',
      endereco: {
        logradouro: 'AV EXEMPLO',
        numero: '250',
        bairro: 'JARDINS',
        municipio: 'JUAZEIRO DO NORTE',
        uf: 'CE',
        cep: '63010-000',
        telefone: '',
      },
    },
    itens,
    totais: {
      vBC: itemCount * 100,
      vICMS: itemCount * 18,
      vProd: itemCount * 100,
      vFrete: 20,
      vSeg: 0,
      vDesc: 0,
      vIPI: 0,
      vNF: itemCount * 100 + 20,
      vTotTrib: itemCount * 18,
    },
    transporte: {
      modFrete: '0',
      transportadoraNome: 'TRANSPORTADORA SINTETICA LTDA',
      transportadoraDoc: '98.765.432/0001-10',
    },
    informacoesComplementares: 'Nota fiscal sintética gerada exclusivamente para testes.',
  }
}

describe('Code 128C encoder', () => {
  it('codifica chave de 44 dígitos com Start C (105), 22 pares, Mod-103 e Stop (106)', () => {
    const key = makeSyntheticKey()
    const encoded = encodeCode128C(key)

    assert.equal(encoded.codes[0], 105)
    assert.equal(encoded.codes[encoded.codes.length - 1], 106)
    assert.equal(encoded.codes.length, 25) // Start C + 22 pares + checksum + Stop
    // 24 símbolos de 11 módulos + Stop de 13 módulos = 277 módulos
    assert.equal(encoded.totalModules, 277)
  })

  it('rejeita entrada vazia ou com quantidade ímpar de dígitos', () => {
    assert.throws(() => encodeCode128C(''), /quantidade par/i)
    assert.throws(() => encodeCode128C('123'), /quantidade par/i)
  })
})

describe('Gerador de DANFE em PDF (jsPDF)', () => {
  it('gera PDF válido de DANFE de 1 página para nota com protocolo', () => {
    const doc = buildDanfePdf(makeSyntheticNfe(3, true), 'agiliza-network.vercel.app')
    assert.ok(doc.output().startsWith('%PDF-'))
    assert.equal(doc.getNumberOfPages(), 1)
  })

  it('gera PDF válido de DANFE mesmo sem protocolo de autorização', () => {
    const doc = buildDanfePdf(makeSyntheticNfe(2, false), 'agiliza-network.vercel.app')
    assert.ok(doc.output().startsWith('%PDF-'))
    assert.equal(doc.getNumberOfPages(), 1)
  })

  it('pagina automaticamente DANFE com 40 itens em múltiplas páginas A4', () => {
    const doc = buildDanfePdf(makeSyntheticNfe(40, true), 'agiliza-network.vercel.app')
    assert.ok(doc.output().startsWith('%PDF-'))
    assert.ok(doc.getNumberOfPages() >= 2, 'Deve paginar automaticamente com 40 itens')
  })
})
