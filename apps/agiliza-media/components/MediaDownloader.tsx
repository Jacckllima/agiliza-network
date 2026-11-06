'use client'

import { Card, Icon, Button } from '@agiliza/ui'

export function MediaDownloader() {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Card variant="elevated" padding="lg" className="w-full" role="region" aria-label="Download de mídia">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
          <div>
            <label htmlFor="media-url" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Link da mídia
            </label>
            <div className="relative">
              <input
                id="media-url"
                type="url"
                disabled
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-500 placeholder-slate-600 cursor-not-allowed focus:outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              O processamento direto de links está temporariamente desativado aguardando autorização de serviços externos.
            </p>
          </div>

          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <Icon name="warning" className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-amber-300">
                  Serviço de download indisponível nesta versão
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Para garantir conformidade legal e direitos autorais, esta ferramenta não realiza downloads simulados nem captura arquivos sem integração homologada com as plataformas.
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full opacity-60 cursor-not-allowed"
            disabled
          >
            Download indisponível
          </Button>
        </form>
      </Card>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Especificações e requisitos técnicos
        </h2>
        <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
          <li>Plataformas previstas: Instagram, TikTok e YouTube (sujeito aos termos de uso de cada provedor).</li>
          <li>Tamanho máximo por arquivo: 500 MB.</li>
          <li>Formatos previstos: MP4 (vídeo) e MP3 (áudio extraído com consentimento).</li>
          <li>Nenhum dado pessoal ou link privado é armazenado permanentemente no sistema.</li>
        </ul>
      </div>
    </div>
  )
}
