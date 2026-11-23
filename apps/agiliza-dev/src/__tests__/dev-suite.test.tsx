import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { DevSuite } from '../../components/DevSuite'

describe('DevSuite', () => {
  it('renders document generator and generates synthetic CPF', () => {
    render(<DevSuite />)

    const generateCpfBtn = screen.getByRole('button', { name: /Gerar CPF/i })
    fireEvent.click(generateCpfBtn)

    expect(screen.getByDisplayValue(/\d{3}\.\d{3}\.\d{3}-\d{2}/)).toBeInTheDocument()
  })

  it('validates invalid CPF and displays error state', () => {
    render(<DevSuite />)

    const input = screen.getByPlaceholderText(/Digite um CPF ou CNPJ/i)
    fireEvent.change(input, { target: { value: '111.111.111-11' } })

    const validateBtn = screen.getByRole('button', { name: /Validar/i })
    fireEvent.click(validateBtn)

    expect(screen.getByText(/Inválido/i)).toBeInTheDocument()
  })
})
