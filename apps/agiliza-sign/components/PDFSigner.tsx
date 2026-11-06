import { Card, Icon } from '@agiliza/ui'

export function PDFSigner() {
  return (
    <Card variant="elevated" padding="lg" className="w-full" role="status">
      <div className="flex items-start gap-3">
        <Icon name="warning" className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <h2 className="text-sm font-semibold text-white">Exportação de PDF indisponível</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Esta versão não aplica a assinatura ao arquivo nem gera um PDF assinado. Não envie documentos por esta tela.
          </p>
        </div>
      </div>
    </Card>
  )
}
