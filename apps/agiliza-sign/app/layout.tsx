import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer, PORTAL_URL, TOOL_URLS } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(TOOL_URLS.sign),
  title: 'AgilizaSign: assinatura visual em arquivos PDF',
  description: 'A ferramenta de assinatura em PDF está indisponível nesta versão.',
  keywords: ['assinatura visual em pdf', 'desenhar assinatura para pdf'],
  authors: [{ name: 'Rede Agiliza', url: PORTAL_URL }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaSign: assinatura visual em PDF',
    description: 'A ferramenta de assinatura em PDF está indisponível nesta versão.',
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
        <Header currentTool="sign" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="sign" />
      </body>
    </html>
  )
}
