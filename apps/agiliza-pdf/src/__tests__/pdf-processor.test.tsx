import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { PDFProcessor } from '../../components/PDFProcessor'

describe('PDFProcessor', () => {
  it('renders accessible tablist and switches between workspaces', () => {
    render(<PDFProcessor />)

    const tablist = screen.getByRole('tablist', {
      name: /Categorias de operações com PDF/i,
    })
    expect(tablist).toBeInTheDocument()

    const organizarTab = screen.getByRole('tab', { name: /Organizar/i })
    const assinarTab = screen.getByRole('tab', { name: /Assinar PDF/i })

    expect(organizarTab).toHaveAttribute('aria-selected', 'true')
    expect(assinarTab).toHaveAttribute('aria-selected', 'false')

    fireEvent.click(assinarTab)

    expect(assinarTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent(/ICP-Brasil/i)
  })

  it('validates uploaded file extension and displays accessible error alert', () => {
    render(<PDFProcessor />)

    const input = screen.getByLabelText(/Arraste arquivos PDF aqui/i)
    const invalidFile = new File(['conteudo'], 'planilha.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    fireEvent.change(input, { target: { files: [invalidFile] } })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/formato não suportado/i)
  })

  it('accepts valid PDF file and allows removing it from the local queue', () => {
    render(<PDFProcessor />)

    const input = screen.getByLabelText(/Arraste arquivos PDF aqui/i)
    const validFile = new File(['%PDF-1.4 content'], 'contrato.pdf', {
      type: 'application/pdf',
    })

    fireEvent.change(input, { target: { files: [validFile] } })

    expect(screen.getByText('contrato.pdf')).toBeInTheDocument()

    const removeButton = screen.getByRole('button', {
      name: /Remover contrato\.pdf/i,
    })
    fireEvent.click(removeButton)

    expect(screen.queryByText('contrato.pdf')).not.toBeInTheDocument()
  })
})
