import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgilizaQR: gerador de QR Codes para Pix, Wi-Fi e links',
  description: 'Gere QR Codes para Pix, Wi-Fi, links, texto e contatos. Baixe a imagem em PNG ou SVG.',
  keywords: ['gerar qr code pix', 'qr code wifi', 'criar qr code'],
  authors: [{ name: 'Rede Agiliza', url: 'https://agilizatools.com.br' }],
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaQR: gerador de QR Codes',
    description: 'Gere QR Codes personalizados para Pix, Wi-Fi, WhatsApp e links.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-950 text-slate-100`}>
        <Header currentTool="qr" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="qr" />
      </body>
    </html>
  )
}
