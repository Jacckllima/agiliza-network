import { Card, Icon } from '@agiliza/ui'

export function MediaDownloader() {
  return (
    <Card variant="elevated" padding="lg" className="w-full" role="status">
      <div className="flex items-start gap-3">
        <Icon name="warning" className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <h2 className="text-sm font-semibold text-white">Download de mídia indisponível</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Esta versão ainda não acessa vídeos ou áudios das plataformas. Nenhum arquivo será analisado ou baixado por esta tela.
          </p>
        </div>
      </div>
    </Card>
  )
}
