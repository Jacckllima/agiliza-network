import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgilizaCalc: simulações CLT/PJ, rescisão e juros',
  description: 'Compare cenários de trabalho, estime rescisão e calcule juros compostos com as premissas exibidas.',
  keywords: ['calculadora clt pj', 'calcular rescisão', 'calculadora juros compostos', 'calcular fgts'],
  authors: [{ name: 'Rede Agiliza', url: 'https://agilizatools.com.br' }],
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaCalc: simulações financeiras e trabalhistas',
    description: 'Simule cenários CLT e PJ, rescisão e juros compostos. Os resultados são estimativas.',
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
        <Header currentTool="calc" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="calc" />
      </body>
    </html>
  )
}
