import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header, Footer } from '@agiliza/ui'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgilizaDev: dados de teste, CPF, CNPJ e CEP',
  description: 'Gere dados de CPF e CNPJ para testes, valide documentos, consulte CEP e codifique texto em Base64.',
  keywords: ['gerar cpf valido teste', 'gerar cnpj', 'validar cpf cnpj', 'consultar cep'],
  authors: [{ name: 'Rede Agiliza', url: 'https://agilizatools.com.br' }],
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    title: 'AgilizaDev: utilitários para desenvolvimento',
    description: 'Gere dados de teste, valide CPF e CNPJ, consulte CEP e use Base64.',
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
        <Header currentTool="dev" />
        <main className="flex-1">{children}</main>
        <Footer currentTool="dev" />
      </body>
    </html>
  )
}
