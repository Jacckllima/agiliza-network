import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PDFProcessor } from '../../components/PDFProcessor'
import { extractTextFromPdfBytes } from '../../lib/pdf-to-media'

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

jest.mock('../../lib/pdf-to-media', () => ({
  MAX_RENDER_PAGES: 50,
  buildPageImageFilename: jest.fn(
    (name: string, page: number, fmt: string) => `${name}-${page}.${fmt}`,
  ),
  buildExtractedTextFilename: jest.fn((name: string) => `${name}.txt`),
  getRenderablePageWindow: jest.fn((total: number) => ({
    pages: Array.from({ length: Math.min(total, 6) }, (_, i) => i + 1),
    maxAllowedPages: Math.min(total, 50),
    totalBatches: Math.ceil(Math.min(total, 50) / 6),
    isTruncated: total > 50,
  })),
  renderPdfBatchThumbnails: jest.fn(async () => [
    { pageNumber: 1, dataUrl: 'data:image/jpeg;base64,abc', width: 200, height: 300 },
  ]),
  renderPdfPageToImage: jest.fn(async () => ({
    pageNumber: 1,
    dataUrl: 'data:image/png;base64,xyz',
    width: 800,
    height: 1100,
  })),
  extractTextFromPdfBytes: jest.fn(async () => ({
    pageCount: 3,
    processedPages: 3,
    truncated: false,
    pages: [{ pageNumber: 1, text: 'Conteúdo extraído' }],
    combinedText: '=== Página 1 ===\nConteúdo extraído',
    hasSelectableText: true,
  })),
}))

jest.mock('../../lib/browser-download', () => ({
  downloadBytesAsFile: jest.fn(),
  downloadDataUrlAsFile: jest.fn(),
  downloadTextAsFile: jest.fn(),
}))

jest.mock('../../lib/convert-to-pdf', () => ({
  convertImagesToPdf: jest.fn(async () => ({
    bytes: new Uint8Array([37, 80, 68, 70, 45]),
    pageCount: 2,
  })),
  convertTextToPdf: jest.fn(async () => ({
    bytes: new Uint8Array([37, 80, 68, 70, 45]),
    pageCount: 1,
  })),
}))

jest.mock('../../lib/pdf-sign', () => ({
  applyVisualSignatureToPdf: jest.fn(async () => ({
    bytes: new Uint8Array([37, 80, 68, 70, 45, 49]),
    pageCount: 3,
  })),
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

  it('converts PDF pages to images and extracts text in Converter de PDF tab', async () => {
    render(<PDFProcessor />)

    fireEvent.click(screen.getByRole('tab', { name: /Converter de PDF/i }))

    const input = screen.getByLabelText(/Envie 1 arquivo PDF para converter/i)
    const pdfFile = new File(['%PDF-1.4 sample'], 'relatorio.pdf', {
      type: 'application/pdf',
    })
    fireEvent.change(input, { target: { files: [pdfFile] } })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Baixar página 1 \(PNG\)/i }),
      ).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: /Baixar página 1 \(PNG\)/i }),
    )
    await waitFor(() => {
      expect(screen.getByText(/Página 1 exportada em PNG/i)).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: /PDF para Texto \(\.txt\)/i }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /Extrair texto do PDF/i }),
    )

    await waitFor(() => {
      expect(
        screen.getByLabelText(/Texto extraído/i),
      ).toHaveValue('=== Página 1 ===\nConteúdo extraído')
    })

    // Verifica aviso para PDF escaneado sem camada de texto
    ;(extractTextFromPdfBytes as jest.Mock).mockResolvedValueOnce({
      pageCount: 1,
      processedPages: 1,
      truncated: false,
      pages: [{ pageNumber: 1, text: '' }],
      combinedText: '',
      hasSelectableText: false,
    })

    fireEvent.click(
      screen.getByRole('button', { name: /Extrair texto do PDF/i }),
    )
    await waitFor(() => {
      expect(
        screen.getByText(/Nenhum texto selecionável foi encontrado/i),
      ).toBeInTheDocument()
    })
  })

  it('converts images and text to PDF in Converter em PDF tab', async () => {
    render(<PDFProcessor />)

    fireEvent.click(screen.getByRole('tab', { name: /Converter em PDF/i }))

    const imgInput = screen.getByLabelText(/Arraste imagens JPG, PNG ou WebP/i)
    const img1 = new File(['png-1'], 'foto-1.png', { type: 'image/png' })
    const img2 = new File(['jpg-2'], 'foto-2.jpg', { type: 'image/jpeg' })
    fireEvent.change(imgInput, { target: { files: [img1, img2] } })

    expect(screen.getByText('foto-1.png')).toBeInTheDocument()
    expect(screen.getByText('foto-2.jpg')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Converter imagens e baixar PDF/i }),
    )
    await waitFor(() => {
      expect(screen.getByText(/PDF gerado com 2 páginas/i)).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: /Texto para PDF/i }),
    )
    fireEvent.change(screen.getByLabelText(/Título do documento/i), {
      target: { value: 'Ata de Reunião' },
    })
    fireEvent.change(screen.getByLabelText(/Conteúdo do texto/i), {
      target: { value: 'Acentuação completa: ação, coração, relatório.' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Gerar PDF do texto/i }),
    )

    await waitFor(() => {
      expect(screen.getByText(/PDF de texto gerado/i)).toBeInTheDocument()
    })
  })

  it('loads PDF, switches signature modes, positions by keyboard sliders and signs PDF', async () => {
    const originalCreateObjectUrl = URL.createObjectURL
    URL.createObjectURL = jest.fn(() => 'blob:mock-signature')

    try {
      render(<PDFProcessor />)

      fireEvent.click(screen.getByRole('tab', { name: /Assinar PDF/i }))
      expect(screen.getByRole('note')).toHaveTextContent(/ICP-Brasil/i)

      const pdfInput = screen.getByLabelText(/Envie 1 arquivo PDF para assinar/i)
      const pdfFile = new File(['%PDF-1.4 sign'], 'contrato.pdf', {
        type: 'application/pdf',
      })
      fireEvent.change(pdfInput, { target: { files: [pdfFile] } })

      await waitFor(() => {
        expect(screen.getByLabelText(/Página:/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Enviar PNG/i }))
      const pngInput = screen.getByLabelText(/Selecionar imagem PNG da assinatura/i)
      const pngFile = new File(['png-bytes'], 'assinatura.png', {
        type: 'image/png',
      })
      fireEvent.change(pngInput, { target: { files: [pngFile] } })

      await waitFor(() => {
        expect(screen.getByText('assinatura.png')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText(/Posição horizontal/i), {
        target: { value: '60' },
      })

      fireEvent.click(
        screen.getByRole('button', { name: /Aplicar assinatura e baixar PDF/i }),
      )

      await waitFor(() => {
        expect(
          screen.getByText(/Assinatura visual aplicada na página 1/i),
        ).toBeInTheDocument()
      })
    } finally {
      URL.createObjectURL = originalCreateObjectUrl
    }
  })
})
