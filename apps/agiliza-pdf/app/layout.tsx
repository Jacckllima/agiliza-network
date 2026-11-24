import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer, PORTAL_URL, TOOL_URLS } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(TOOL_URLS.pdf),
  title: 'AgilizaPDF: ferramentas para arquivos PDF no navegador',
  description:
    'Junte, divida, converta, assine visualmente, edite, proteja com senha, faça OCR e otimize arquivos PDF diretamente no navegador, sem envio para servidores.',
  keywords: [
    'ferramentas para pdf',
    'juntar pdf',
    'dividir pdf',
    'converter pdf',
    'assinar pdf',
    'proteger pdf com senha',
    'ocr pdf',
    'scanner pdf',
    'comprimir pdf',
    'agiliza pdf',
  ],
  authors: [{ name: 'Rede Agiliza', url: PORTAL_URL }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaPDF: ferramentas para arquivos PDF no navegador',
    description:
      'Ferramentas locais para manipular, converter, assinar e otimizar arquivos PDF no navegador.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="light" data-theme="light">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Header currentTool="pdf" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="pdf" />
      </body>
    </html>
  )
}
