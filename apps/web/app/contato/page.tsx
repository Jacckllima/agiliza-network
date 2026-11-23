import type { Metadata } from 'next'
import Link from 'next/link'
import { Container, Card, Icon } from '@agiliza/ui'
import { ContactChannels } from '../../components/ContactChannels'

export const metadata: Metadata = {
  title: 'Contato | Agiliza Tools',
  description:
    'Entre em contato com a equipe da Rede Agiliza por e-mail ou pelo GitHub oficial para suporte, relatos de erro e solicitações sobre privacidade ou termos.',
  alternates: { canonical: '/contato' },
}

export default function ContactPage() {
  return (
    <Container size="lg" className="py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Voltar ao início
        </Link>
      </nav>

      <header className="mb-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          <Icon name="message" className="h-3.5 w-3.5" />
          Canal Institucional
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Contato e Suporte
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Escolha o canal mais adequado abaixo para enviar dúvidas, relatar problemas técnicos ou
          tratar de assuntos relacionados às nossas políticas.
        </p>
      </header>

      <div className="space-y-8">
        <ContactChannels />

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Como agilizar o atendimento
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <li>Informe o nome da ferramenta ou o endereço da página em que o problema ocorreu.</li>
            <li>Descreva o passo a passo realizado e o resultado esperado.</li>
            <li>Se possível, inclua o navegador e o sistema operacional utilizados.</li>
            <li>Não envie senhas, documentos confidenciais ou dados bancários por e-mail ou em issues públicas.</li>
          </ul>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Documentos institucionais relacionados
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Esta página não armazena mensagens em banco de dados próprio: o envio ocorre diretamente
            pelo seu provedor de e-mail ou pela sua conta do GitHub. Consulte também:
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
            <Link
              href="/privacidade"
              className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
            >
              Política de Privacidade
            </Link>
            <Link
              href="/termos"
              className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
            >
              Termos e Condições de Uso
            </Link>
          </div>
        </Card>
      </div>
    </Container>
  )
}
