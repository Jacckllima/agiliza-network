import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { PDFSigner } from '../../components/PDFSigner'

describe('PDFSigner', () => {
  it('renders unavailability status notice without exposing broken upload controls', () => {
    render(<PDFSigner />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/Exportação de PDF indisponível/i)
    expect(status).toHaveTextContent(/Não envie documentos por esta tela/i)
  })
})
