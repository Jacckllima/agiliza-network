import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { AdSlot } from '../components/AdSlot'

describe('AdSlot', () => {
  it('renders nothing by default when NEXT_PUBLIC_ADSENSE_CLIENT is not configured', () => {
    const { container } = render(<AdSlot slot="nota-bottom" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when disabled is true even if clientId is provided', () => {
    const { container } = render(
      <AdSlot slot="nota-bottom" clientId="ca-pub-0000000000000000" disabled />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders print-hidden ad container when clientId and slot are configured', () => {
    render(<AdSlot slot="nota-bottom" clientId="ca-pub-0000000000000000" />)
    const aside = screen.getByLabelText('Publicidade')
    expect(aside).toBeInTheDocument()
    expect(aside.className).toContain('print:hidden')
  })
})
