import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgilizaText: contador de texto e ferramentas para JSON',
  description: 'Conte caracteres e palavras, compare textos, altere a caixa e formate JSON.',
  keywords: ['contar caracteres online', 'contador palavras', 'formatar json online', 'comparar textos'],
  authors: [{ name: 'Rede Agiliza', url: 'https://agilizatools.com.br' }],
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaText: utilitários de texto e JSON',
    description: 'Contador de palavras, formatador JSON e conversor de caixa.',
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
        <Header currentTool="text" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="text" />
      </body>
    </html>
  )
}
