'use client'

import { useState } from 'react'
import { CONTACT_EMAIL, GITHUB_ISSUES_URL, GITHUB_REPO_URL, Card, Icon } from '@agiliza/ui'

type CopyStatus = 'idle' | 'copied' | 'error'

export function ContactChannels() {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 3000)
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="flex flex-col justify-between p-6 sm:p-8">
        <div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300">
            <Icon name="message" className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
            E-mail de suporte
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Canal direto para dúvidas sobre as ferramentas, solicitações relacionadas à Política de
            Privacidade (LGPD) ou questões sobre os Termos de Uso.
          </p>
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
            {CONTACT_EMAIL}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2.5">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Contato%20Agiliza%20Tools`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Enviar e-mail
            </a>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copyStatus === 'copied' ? 'E-mail copiado' : 'Copiar e-mail'}
            </button>
          </div>

          <div aria-live="polite" className="min-h-[20px] text-xs">
            {copyStatus === 'copied' && (
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Endereço copiado para a área de transferência.
              </p>
            )}
            {copyStatus === 'error' && (
              <p className="font-medium text-red-600 dark:text-red-400">
                Não foi possível copiar automaticamente. Selecione o endereço acima para copiar manualmente.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col justify-between p-6 sm:p-8">
        <div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300">
            <Icon name="code" className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
            Relatos técnicos no GitHub
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Para reportar falhas em alguma ferramenta, sugerir melhorias ou acompanhar a evolução do
            código, abra uma issue no repositório público da Rede Agiliza.
          </p>
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            github.com/agilizatoolsoficial/agiliza-network
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Abrir issue no GitHub
          </a>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Ver repositório
          </a>
        </div>
      </Card>
    </div>
  )
}
