import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { QRGenerator } from '../../components/QRGenerator'

describe('QRGenerator', () => {
  it('renders QR generator tablist with Pix and Link tabs', () => {
    render(<QRGenerator />)

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Pix/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Link/i })).toBeInTheDocument()
  })

  it('switches between Pix and Link tabs and accepts synthetic input', () => {
    render(<QRGenerator />)

    const linkTab = screen.getByRole('tab', { name: /Link/i })
    fireEvent.click(linkTab)

    expect(linkTab).toHaveAttribute('aria-selected', 'true')
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
  })
})
