import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDeclaracaoPdf, buildReciboPdf } from './pdf-generator.ts'

describe('PDF generator (client-side jsPDF)', () => {
  it('gera PDF válido de Recibo de Pagamento com cabeçalho %PDF-', () => {
    const doc = buildReciboPdf(
      {
        numero: '0042',
        emissorNome: 'Maria Souza',
        emissorDoc: '123.456.789-01',
        pagadorNome: 'Empresa Sintética Ltda',
        pagadorDoc: '12.345.678/0001-99',
        valor: 1250.5,
        referente: 'Consultoria técnica de desenvolvimento web com acentuação: ç, á, õ.',
        cidade: 'Juazeiro do Norte / CE',
        dataDoc: '23/11/2026',
      },
      'agiliza-network.vercel.app',
    )

    const output = doc.output('datauristring')
    const raw = doc.output()
    assert.ok(output.startsWith('data:application/pdf'))
    assert.ok(raw.startsWith('%PDF-'))
    assert.equal(doc.getNumberOfPages(), 1)
  })

  it('gera PDF de Declaração de Conteúdo com paginação automática para muitos itens', () => {
    const itens = Array.from({ length: 45 }, (_, idx) => ({
      id: `item-${idx + 1}`,
      desc: `Item de teste sintético número ${idx + 1} com descrição detalhada`,
      qtd: 2,
      valor: 15.5,
    }))

    const doc = buildDeclaracaoPdf(
      {
        remetenteNome: 'Remetente Sintético',
        remetenteDoc: '123.456.789-01',
        remetenteEnd: 'Rua Exemplo, 100 - Centro',
        destinatarioNome: 'Destinatário Sintético',
        destinatarioDoc: '987.654.321-00',
        destinatarioEnd: 'Av. Teste, 200 - Bairro Novo',
        cidade: 'São Paulo / SP',
        dataDoc: '23/11/2026',
        itens,
      },
      'agiliza-network.vercel.app',
    )

    const raw = doc.output()
    assert.ok(raw.startsWith('%PDF-'))
    assert.ok(doc.getNumberOfPages() >= 2, 'Deve paginar automaticamente com 45 itens')
  })
})
