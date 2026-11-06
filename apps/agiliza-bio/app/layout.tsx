import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgilizaBio: editor de prévia de página com links',
  description: 'Monte uma prévia local de uma página com links. A publicação de um endereço compartilhável ainda não está disponível.',
  keywords: ['editor de página com links', 'prévia de links para bio'],
  authors: [{ name: 'Rede Agiliza', url: 'https://agilizatools.com.br' }],
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaBio: editor de prévia de links',
    description: 'Monte e visualize localmente uma página com links.',
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
        <Header currentTool="bio" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="bio" />
      </body>
    </html>
  )
}
