import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { DocumentGenerator } from '../../components/DocumentGenerator'

describe('DocumentGenerator', () => {
  it('renders Recibo by default and updates preview with synthetic input', () => {
    render(<DocumentGenerator />)

    expect(screen.getAllByText(/Recibo de Pagamento/i).length).toBeGreaterThan(0)

    const textInputs = screen.getAllByRole('textbox')
    expect(textInputs.length).toBeGreaterThan(0)
    fireEvent.change(textInputs[0]!, { target: { value: 'Empresa Teste Sintética' } })

    expect(screen.getByText(/Empresa Teste Sintética/i)).toBeInTheDocument()
  })

  it('switches to Declaração de Conteúdo tab', () => {
    render(<DocumentGenerator />)

    fireEvent.click(screen.getByRole('button', { name: /Declaração de Conteúdo/i }))
    expect(screen.getAllByText(/Declaração de Conteúdo/i).length).toBeGreaterThan(0)
  })
})
