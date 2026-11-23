import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  computeAccessKeyCheckDigit,
  formatAccessKey,
  validateAndDecodeAccessKey,
} from './nfe-key.ts'
import { parseNfeXml } from './nfe-xml-parser.ts'

function buildSyntheticAccessKey(overrides: { uf?: string; aamm?: string; mod?: string } = {}): string {
  const uf = overrides.uf ?? '35'
  const aamm = overrides.aamm ?? '2611'
  const cnpj = '12345678000195'
  const mod = overrides.mod ?? '55'
  const serie = '001'
  const nNF = '000000123'
  const tpEmis = '1'
  const cNF = '12345678'
  const first43 = `${uf}${aamm}${cnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`
  const dv = computeAccessKeyCheckDigit(first43)
  return `${first43}${dv}`
}

function buildSyntheticNfeXml(accessKey: string, withProtocol = true): string {
  const protBlock = withProtocol
    ? `<protNFe versao="4.00">
        <infProt>
          <chNFe>${accessKey}</chNFe>
          <dhRecbto>2026-11-23T14:35:00-03:00</dhRecbto>
          <nProt>135260000123456</nProt>
          <cStat>100</cStat>
          <xMotivo>Autorizado o uso da NF-e</xMotivo>
        </infProt>
      </protNFe>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${accessKey}" versao="4.00">
      <ide>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>123</nNF>
        <dhEmi>2026-11-23T14:30:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <tpAmb>1</tpAmb>
      </ide>
      <emit>
        <CNPJ>12345678000195</CNPJ>
        <xNome>EMPRESA SINTETICA DE TESTE LTDA</xNome>
        <xFant>AGILIZA TESTE</xFant>
        <enderEmit>
          <xLgr>RUA MODELO</xLgr>
          <nro>100</nro>
          <xBairro>CENTRO</xBairro>
          <xMun>SAO PAULO</xMun>
          <UF>SP</UF>
          <CEP>01001000</CEP>
        </enderEmit>
        <IE>123456789012</IE>
      </emit>
      <dest>
        <CPF>12345678901</CPF>
        <xNome>CLIENTE SINTETICO &amp; CIA</xNome>
        <enderDest>
          <xLgr>AV EXEMPLO</xLgr>
          <nro>250</nro>
          <xBairro>JARDINS</xBairro>
          <xMun>JUAZEIRO DO NORTE</xMun>
          <UF>CE</UF>
          <CEP>63010000</CEP>
        </enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>SKU-001</cProd>
          <xProd>PRODUTO SINTETICO A</xProd>
          <NCM>84713012</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>150.00</vUnCom>
          <vProd>300.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vBC>300.00</vBC>
          <vICMS>54.00</vICMS>
          <vProd>300.00</vProd>
          <vFrete>20.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>10.00</vDesc>
          <vIPI>0.00</vIPI>
          <vNF>310.00</vNF>
          <vTotTrib>54.00</vTotTrib>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>0</modFrete>
      </transp>
      <infAdic>
        <infCpl>Documento sintético para testes automatizados.</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
  ${protBlock}
</nfeProc>`
}

describe('Validação de chave de acesso de 44 dígitos', () => {
  it('valida e decodifica corretamente uma chave sintética NF-e modelo 55', () => {
    const key = buildSyntheticAccessKey()
    const result = validateAndDecodeAccessKey(formatAccessKey(key))

    assert.equal(result.valid, true)
    if (result.valid) {
      assert.equal(result.data.ufSigla, 'SP')
      assert.equal(result.data.yearMonth, '11/2026')
      assert.equal(result.data.emitenteCnpj, '12.345.678/0001-95')
      assert.equal(result.data.modelo, '55')
      assert.equal(result.data.serie, '1')
      assert.equal(result.data.numero, '123')
    }
  })

  it('rejeita chave com dígito verificador incorreto', () => {
    const key = buildSyntheticAccessKey()
    const wrongDv = (Number(key[43]) + 1) % 10
    const tampered = `${key.slice(0, 43)}${wrongDv}`
    const result = validateAndDecodeAccessKey(tampered)

    assert.equal(result.valid, false)
    if (!result.valid) {
      assert.match(result.error, /Dígito verificador/i)
    }
  })

  it('rejeita chave com menos de 44 dígitos ou modelo não suportado', () => {
    assert.equal(validateAndDecodeAccessKey('12345').valid, false)

    const invalidModelKey = buildSyntheticAccessKey({ mod: '57' })
    const modelRes = validateAndDecodeAccessKey(invalidModelKey)
    assert.equal(modelRes.valid, false)
  })
})

describe('Parser de XML de NF-e (client-side)', () => {
  it('extrai emitente, destinatário, itens, totais e protocolo de XML sintético', () => {
    const key = buildSyntheticAccessKey()
    const parsed = parseNfeXml(buildSyntheticNfeXml(key, true))

    assert.equal(parsed.accessKey, key)
    assert.equal(parsed.hasProtocol, true)
    assert.equal(parsed.protocolo?.numero, '135260000123456')
    assert.equal(parsed.emitente.nome, 'EMPRESA SINTETICA DE TESTE LTDA')
    assert.equal(parsed.destinatario.nome, 'CLIENTE SINTETICO & CIA')
    assert.equal(parsed.itens.length, 1)
    assert.equal(parsed.itens[0]?.codigo, 'SKU-001')
    assert.equal(parsed.totais.vNF, 310)
  })

  it('identifica XML sem protocolo de autorização (protNFe ausente)', () => {
    const key = buildSyntheticAccessKey()
    const parsed = parseNfeXml(buildSyntheticNfeXml(key, false))

    assert.equal(parsed.hasProtocol, false)
    assert.equal(parsed.protocolo, undefined)
  })

  it('rejeita conteúdo não-XML ou XML que não seja NF-e', () => {
    assert.throws(() => parseNfeXml('texto qualquer'), /XML válido/i)
    assert.throws(() => parseNfeXml('<root><outro>1</outro></root>'), /infNFe/i)
  })
})
