import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { BioBuilder } from '../../components/BioBuilder'

describe('BioBuilder', () => {
  it('renders the bio builder component', () => {
    render(<BioBuilder />)
    expect(screen.getByText(/Personalizar seu Bio Link/i)).toBeInTheDocument()
  })

  it('has theme selector options', () => {
    render(<BioBuilder />)
    expect(screen.getByText('Azul')).toBeInTheDocument()
    expect(screen.getByText('Ciano')).toBeInTheDocument()
    expect(screen.getByText('Cinza')).toBeInTheDocument()
  })

  it('displays local preview warning and disables publishing', () => {
    render(<BioBuilder />)
    expect(screen.getByRole('status')).toHaveTextContent(/prévia local/i)
    const publishBtn = screen.getByRole('button', { name: /publicação e link compartilhável indisponíveis/i })
    expect(publishBtn).toBeInTheDocument()
    expect(publishBtn).toBeDisabled()
  })
})
