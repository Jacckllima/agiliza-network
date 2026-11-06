import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgilizaPDF: ferramentas para arquivos PDF',
  description: 'As operações com arquivos PDF estão indisponíveis nesta versão do AgilizaPDF.',
  keywords: ['ferramentas para pdf', 'agiliza pdf'],
  authors: [{ name: 'Rede Agiliza', url: 'https://agilizatools.com.br' }],
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaPDF: ferramentas para arquivos PDF',
    description: 'As operações com arquivos PDF estão indisponíveis nesta versão.',
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
        <Header currentTool="pdf" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="pdf" />
      </body>
    </html>
  )
}
