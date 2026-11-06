import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MediaDownloader } from '../../components/MediaDownloader'

describe('MediaDownloader', () => {
  it('renders the media downloader component', () => {
    render(<MediaDownloader />)
    expect(screen.getByRole('region', { name: /download de mídia/i })).toBeInTheDocument()
  })

  it('renders URL input as disabled', () => {
    render(<MediaDownloader />)
    const input = screen.getByLabelText(/link da mídia/i)
    expect(input).toBeInTheDocument()
    expect(input).toBeDisabled()
  })

  it('renders download button as disabled with unavailable message', () => {
    render(<MediaDownloader />)
    const button = screen.getByRole('button', { name: /download indisponível/i })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('informs that media download is unavailable in this version', () => {
    render(<MediaDownloader />)
    expect(screen.getByText(/serviço de download indisponível/i)).toBeInTheDocument()
  })
})
