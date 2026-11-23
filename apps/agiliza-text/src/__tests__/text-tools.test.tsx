import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { TextTools } from '../../components/TextTools'

describe('TextTools', () => {
  it('updates character and word counts when text changes', () => {
    render(<TextTools />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'um dois tres' } })

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows syntax error for invalid JSON and formats valid JSON', () => {
    render(<TextTools />)

    fireEvent.click(screen.getByRole('button', { name: /Formatador JSON/i }))

    const jsonBox = screen.getByRole('textbox')
    fireEvent.change(jsonBox, { target: { value: '{invalido' } })
    fireEvent.click(screen.getByRole('button', { name: /Format \(2 Espaços\)/i }))

    expect(screen.getByText(/Erro de sintaxe JSON/i)).toBeInTheDocument()

    fireEvent.change(jsonBox, { target: { value: '{"ok":true}' } })
    fireEvent.click(screen.getByRole('button', { name: /Format \(2 Espaços\)/i }))

    expect(screen.queryByText(/Erro de sintaxe JSON/i)).not.toBeInTheDocument()
  })
})
