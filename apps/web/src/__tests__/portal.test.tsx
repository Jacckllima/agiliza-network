import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import Home from '../../app/page'
import { ContactChannels } from '../../components/ContactChannels'

describe('Portal Home', () => {
  it('renders all tools and filters by search query and category', () => {
    render(<Home />)

    expect(screen.getByText('AgilizaQR')).toBeInTheDocument()
    expect(screen.getByText('AgilizaCalc')).toBeInTheDocument()

    const searchInput = screen.getByLabelText('Buscar ferramenta')
    fireEvent.change(searchInput, { target: { value: 'Pix' } })

    expect(screen.getByText('AgilizaQR')).toBeInTheDocument()
    expect(screen.queryByText('AgilizaCalc')).not.toBeInTheDocument()
  })

  it('shows empty state and resets filters when no tool matches', () => {
    render(<Home />)

    const searchInput = screen.getByLabelText('Buscar ferramenta')
    fireEvent.change(searchInput, { target: { value: 'ferramenta-inexistente-xyz' } })

    expect(screen.getByText(/Nenhuma ferramenta encontrada/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver todas as ferramentas/i }))
    expect(screen.getByText('AgilizaQR')).toBeInTheDocument()
  })

  it('switches category tabs with aria-selected state', () => {
    render(<Home />)

    const financeTab = screen.getByRole('tab', { name: 'Finanças & Cálculos' })
    fireEvent.click(financeTab)

    expect(financeTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('AgilizaCalc')).toBeInTheDocument()
    expect(screen.queryByText('AgilizaQR')).not.toBeInTheDocument()
  })
})

describe('ContactChannels', () => {
  it('renders official email and GitHub links and handles copy error state gracefully', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })

    render(<ContactChannels />)

    expect(screen.getByRole('link', { name: /Enviar e-mail/i })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:'),
    )
    expect(screen.getByRole('link', { name: /Abrir issue no GitHub/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Copiar e-mail/i }))
    expect(await screen.findByText(/Não foi possível copiar automaticamente/i)).toBeInTheDocument()
  })
})
