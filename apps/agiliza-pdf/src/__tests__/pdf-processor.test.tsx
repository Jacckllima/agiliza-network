import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { PDFProcessor } from '../../components/PDFProcessor'

describe('PDFProcessor', () => {
  it('renders unavailability status notice without exposing broken PDF controls', () => {
    render(<PDFProcessor />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/Operações com PDF indisponíveis/i)
    expect(status).toHaveTextContent(/Nenhum arquivo é processado nesta tela/i)
  })
})
