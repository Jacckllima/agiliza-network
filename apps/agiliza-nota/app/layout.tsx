import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer, PORTAL_URL, TOOL_URLS } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(TOOL_URLS.nota),
  title: 'AgilizaNota: recibos, declarações e DANFE de NF-e em PDF',
  description: 'Gere recibos de pagamento, declarações de conteúdo e DANFE de NF-e em PDF a partir de XML ou chave de acesso.',
  keywords: ['gerar recibo de pagamento', 'recibo em pdf', 'declaração de conteúdo', 'danfe pdf', 'xml nfe para pdf'],
  authors: [{ name: 'Rede Agiliza', url: PORTAL_URL }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaNota: recibos e declarações em PDF',
    description: 'Preencha os dados para gerar um recibo ou uma declaração de conteúdo em PDF.',
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
        <Header currentTool="nota" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="nota" />
      </body>
    </html>
  )
}
