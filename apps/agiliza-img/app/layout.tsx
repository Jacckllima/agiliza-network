import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgilizaImg: converter e redimensionar imagens',
  description: 'Ajuste dimensões e qualidade e exporte imagens em WebP, JPEG ou PNG.',
  keywords: ['converter imagem para webp', 'redimensionar imagem', 'ajustar qualidade de imagem'],
  authors: [{ name: 'Rede Agiliza', url: 'https://agilizatools.com.br' }],
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaImg: conversor de imagens',
    description: 'Redimensione imagens, ajuste a qualidade e escolha entre WebP, JPEG e PNG.',
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
        <Header currentTool="img" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="img" />
      </body>
    </html>
  )
}
