import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgilizaMedia: ferramenta de download de mídia',
  description: 'O AgilizaMedia ainda não oferece um fluxo funcional para obter ou baixar arquivos de mídia.',
  keywords: ['ferramenta de mídia', 'agiliza media'],
  authors: [{ name: 'Rede Agiliza', url: 'https://agilizatools.com.br' }],
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaMedia: ferramenta de download de mídia',
    description: 'O fluxo de download de mídia está indisponível nesta versão.',
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
        <Header currentTool="media" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="media" />
      </body>
    </html>
  )
}
