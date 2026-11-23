import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PDFProcessor } from '../../components/PDFProcessor'

jest.mock('../../lib/pdf-operations', () => ({
  inspectPdfBytes: jest.fn(async () => ({ pageCount: 3 })),
  mergePdfDocuments: jest.fn(async () => ({
    bytes: new Uint8Array([37, 80, 68, 70, 45]),
    pageCount: 6,
  })),
  extractPdfPages: jest.fn(async () => ({
    bytes: new Uint8Array([37, 80, 68, 70, 45]),
    pageCount: 2,
  })),
  rotatePdfPages: jest.fn(async () => ({
    bytes: new Uint8Array([37, 80, 68, 70, 45]),
    pageCount: 3,
  })),
  removePdfPages: jest.fn(async () => ({
    bytes: new Uint8Array([37, 80, 68, 70, 45]),
    pageCount: 2,
  })),
  parsePageRange: jest.fn(() => [1, 2]),
}))

jest.mock('../../lib/browser-download', () => ({
  downloadBytesAsFile: jest.fn(),
}))

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

    const input = screen.getByLabelText(/Arraste os arquivos PDF para juntar/i)
    const invalidFile = new File(['conteudo'], 'planilha.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    fireEvent.change(input, { target: { files: [invalidFile] } })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/formato não suportado/i)
  })

  it('loads two PDFs in merge mode, allows reordering and triggers merge', async () => {
    render(<PDFProcessor />)

    const input = screen.getByLabelText(/Arraste os arquivos PDF para juntar/i)
    const fileA = new File(['%PDF-1.4 a'], 'parte-1.pdf', {
      type: 'application/pdf',
    })
    const fileB = new File(['%PDF-1.4 b'], 'parte-2.pdf', {
      type: 'application/pdf',
    })

    fireEvent.change(input, { target: { files: [fileA, fileB] } })

    await waitFor(() => {
      expect(screen.getByText('parte-1.pdf')).toBeInTheDocument()
      expect(screen.getByText('parte-2.pdf')).toBeInTheDocument()
    })

    const mergeButton = screen.getByRole('button', {
      name: /Juntar e baixar PDF/i,
    })
    expect(mergeButton).toBeEnabled()

    fireEvent.click(mergeButton)

    await waitFor(() => {
      expect(screen.getByText(/PDF mesclado pronto/i)).toBeInTheDocument()
    })
  })

  it('switches organize modes between merge, split, rotate and remove', () => {
    render(<PDFProcessor />)

    fireEvent.click(screen.getByRole('button', { name: /Dividir e extrair/i }))
    expect(
      screen.getByLabelText(/Páginas ou intervalos para extrair/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Girar páginas/i }))
    expect(screen.getByRole('button', { name: '90°' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Remover páginas/i }))
    expect(screen.getByLabelText(/Páginas para remover/i)).toBeInTheDocument()
  })
})
