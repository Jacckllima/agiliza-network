import { PDFSigner } from '../components/PDFSigner'
import { Icon } from '@agiliza/ui'

export default function SignPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center">
      <section className="text-center mb-8 w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 border border-blue-800/60 px-3.5 py-1 text-xs font-semibold text-blue-300 mb-3">
          <Icon name="penTool" className="h-4 w-4" />
          <span>Exportação indisponível nesta versão</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          AgilizaSign: assinatura visual em PDF
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          A ferramenta ainda não aplica uma assinatura ao arquivo nem exporta um PDF. Não envie documentos por esta tela.
        </p>
      </section>

      <section className="w-full">
        <PDFSigner />
      </section>
    </div>
  )
}
