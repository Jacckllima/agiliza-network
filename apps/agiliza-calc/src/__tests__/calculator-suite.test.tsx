import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { CalculatorSuite } from '../../components/CalculatorSuite'

describe('CalculatorSuite', () => {
  it('renders CLT vs PJ tab by default with premises and disclaimer', () => {
    render(<CalculatorSuite />)

    expect(screen.getByRole('tab', { name: /CLT vs PJ/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Estimativa CLT/i)).toBeInTheDocument()
    expect(screen.getByText(/Premissas e referências usadas nesta estimativa/i)).toBeInTheDocument()
  })

  it('switches between Rescisão CLT and Juros Compostos tabs', () => {
    render(<CalculatorSuite />)

    const rescisaoTab = screen.getByRole('tab', { name: /Rescisão CLT/i })
    fireEvent.click(rescisaoTab)
    expect(rescisaoTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Estimativa Bruta da Rescisão/i)).toBeInTheDocument()

    const jurosTab = screen.getByRole('tab', { name: /Juros Compostos/i })
    fireEvent.click(jurosTab)
    expect(jurosTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Montante Final Acumulado/i)).toBeInTheDocument()
  })
})
