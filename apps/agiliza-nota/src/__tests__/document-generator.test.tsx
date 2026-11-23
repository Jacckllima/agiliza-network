import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { DocumentGenerator } from '../../components/DocumentGenerator'

const mockDownloadReciboPdf = jest.fn((..._args: unknown[]) => 'recibo-pagamento-0001.pdf')
const mockDownloadDeclaracaoPdf = jest.fn((..._args: unknown[]) => 'declaracao-conteudo.pdf')
const mockDownloadDanfePdf = jest.fn((..._args: unknown[]) => 'danfe-nfe-123.pdf')

jest.mock('../../lib/pdf-generator', () => ({
  downloadReciboPdf: (...args: unknown[]) => mockDownloadReciboPdf(...args),
  downloadDeclaracaoPdf: (...args: unknown[]) => mockDownloadDeclaracaoPdf(...args),
}))

jest.mock('../../lib/danfe-pdf', () => ({
  downloadDanfePdf: (...args: unknown[]) => mockDownloadDanfePdf(...args),
}))

describe('DocumentGenerator', () => {
  it('renders Recibo tab with accessible labels, applies CPF mask, and updates preview', () => {
    render(<DocumentGenerator />)

    expect(screen.getByRole('tab', { name: /Recibo de Pagamento/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const emissorInput = screen.getByLabelText(/Nome de quem recebeu/i)
    const cpfInput = screen.getByLabelText(/CPF\/CNPJ do Emissor/i)

    fireEvent.change(emissorInput, { target: { value: 'Empresa Teste Sintética' } })
    fireEvent.change(cpfInput, { target: { value: '12345678901' } })

    expect(cpfInput).toHaveValue('123.456.789-01')
    expect(screen.getByText('Empresa Teste Sintética')).toBeInTheDocument()
  })

  it('shows inline validation errors when exporting an incomplete Recibo', () => {
    render(<DocumentGenerator />)

    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/i }))

    expect(screen.getByText(/Informe o nome de quem recebeu/i)).toBeInTheDocument()
    expect(screen.getByText(/Informe um valor maior que zero/i)).toBeInTheDocument()
  })

  it('switches to Declaração de Conteúdo and allows adding items dynamically', () => {
    render(<DocumentGenerator />)

    const declTab = screen.getByRole('tab', { name: /Declaração de Conteúdo/i })
    fireEvent.click(declTab)

    expect(declTab).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Adicionar item/i }))
    expect(screen.getByLabelText(/Descrição #2/i)).toBeInTheDocument()
  })

  it('exports Recibo PDF when required fields are filled', () => {
    render(<DocumentGenerator />)

    fireEvent.change(screen.getByLabelText(/Nome de quem recebeu/i), {
      target: { value: 'Maria Souza' },
    })
    fireEvent.change(screen.getByLabelText(/Nome de quem pagou/i), {
      target: { value: 'João Silva' },
    })
    fireEvent.change(screen.getByLabelText(/Valor Recebido/i), {
      target: { value: '350' },
    })
    fireEvent.change(screen.getByLabelText(/Referente a/i), {
      target: { value: 'Serviço de consultoria' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Baixar PDF/i }))

    expect(mockDownloadReciboPdf).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/PDF gerado e baixado: recibo-pagamento-0001.pdf/i)).toBeInTheDocument()
  })

  it('renders NF-e / DANFE tab with XML upload and 44-digit key validation', () => {
    render(<DocumentGenerator />)

    const nfeTab = screen.getByRole('tab', { name: /NF-e \/ DANFE/i })
    fireEvent.click(nfeTab)

    expect(screen.getByLabelText(/Chave de acesso da NF-e/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Chave de acesso da NF-e/i), {
      target: { value: '12345' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Validar chave/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/44 dígitos numéricos/i)
  })
})
