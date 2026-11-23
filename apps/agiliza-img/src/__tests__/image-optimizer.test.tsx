import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImageOptimizer } from '../../components/ImageOptimizer'

describe('ImageOptimizer', () => {
  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: jest.fn(() => 'blob:synthetic-preview'),
      configurable: true,
    })
  })

  it('renders output settings and accepts a synthetic image file', () => {
    const { container } = render(<ImageOptimizer />)

    expect(screen.getByText(/Formato de saída/i)).toBeInTheDocument()

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).not.toBeNull()

    const syntheticFile = new File(['fake-image-bytes'], 'amostra-teste.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [syntheticFile] } })

    expect(screen.getByText('amostra-teste.png')).toBeInTheDocument()
  })
})
