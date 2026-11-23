import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { DocumentGenerator } from '../../components/DocumentGenerator'

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

  it('shows inline validation errors when printing an incomplete Recibo', () => {
    render(<DocumentGenerator />)

    fireEvent.click(screen.getByRole('button', { name: /Imprimir \/ Salvar em PDF/i }))

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

  it('shows honest status notice on NF-e / DANFE tab', () => {
    render(<DocumentGenerator />)

    const nfeTab = screen.getByRole('tab', { name: /NF-e \/ DANFE/i })
    fireEvent.click(nfeTab)

    expect(screen.getByRole('status')).toHaveTextContent(/em desenvolvimento/i)
  })
})
