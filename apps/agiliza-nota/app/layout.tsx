import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgilizaNota: gerador de recibos e declarações em PDF',
  description: 'Gere recibos de pagamento e declarações de conteúdo em PDF.',
  keywords: ['gerar recibo de pagamento', 'recibo em pdf', 'declaração de conteúdo'],
  authors: [{ name: 'Rede Agiliza', url: 'https://agilizatools.com.br' }],
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
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-950 text-slate-100`}>
        <Header currentTool="nota" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="nota" />
      </body>
    </html>
  )
}
