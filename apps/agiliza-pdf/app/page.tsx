import { PDFProcessor } from '../components/PDFProcessor'
import { Icon } from '@agiliza/ui'

export default function PDFPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center">
      {/* Hero */}
      <section className="text-center mb-8 w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-950 border border-blue-800/60 px-3 py-1 text-xs font-semibold text-blue-300 mb-3">
          <Icon name="file" className="h-4 w-4" />
          <span>Operações indisponíveis nesta versão</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          AgilizaPDF: operações com PDF
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          A ferramenta ainda não mescla, divide, gira nem converte arquivos. Não envie documentos por esta tela.
        </p>
      </section>

      {/* Main Processor Workspace */}
      <section className="w-full">
        <PDFProcessor />
      </section>

    </div>
  )
}
