import { AdSlot, Icon } from '@agiliza/ui'
import { PDFProcessor } from '../components/PDFProcessor'

const HOW_TO_STEPS = [
  {
    title: '1. Escolha a categoria de operação',
    description:
      'Use a barra de abas para selecionar entre organizar páginas, converter de ou para PDF, assinar visualmente, editar, proteger ou comprimir.',
  },
  {
    title: '2. Selecione seus arquivos localmente',
    description:
      'Arraste o documento ou clique no botão de seleção. A validação de formato e tamanho seguro acontece na hora, diretamente no navegador.',
  },
  {
    title: '3. Processe e baixe no dispositivo',
    description:
      'As operações client-side rodam apenas na memória do seu navegador, sem enviar documentos para servidores externos, com download de 1 operação por vez.',
  },
] as const

const FAQ_ITEMS = [
  {
    question: 'O AgilizaPDF envia meus arquivos PDF para algum servidor?',
    answer:
      'Não. Todas as ferramentas da Fase 1 (organizar, converter imagens e texto, assinar visualmente, editar, proteger e comprimir) foram projetadas para rodar 100% na memória do seu navegador.',
  },
  {
    question: 'Qual é o tamanho máximo de arquivo aceito?',
    answer:
      'Para evitar travamentos da aba do navegador, o limite seguro é de até 25 MB por arquivo (e até 50 MB somados em até 15 arquivos ao juntar PDFs).',
  },
  {
    question: 'A assinatura visual tem validade de certificado digital ICP-Brasil?',
    answer:
      'Não. A assinatura visual insere graficamente seu desenho, texto ou imagem PNG sobre o documento. Ela não aplica assinatura criptográfica com certificado digital ICP-Brasil.',
  },
  {
    question: 'Por que conversões de Word, Excel e PowerPoint não estão no modo local?',
    answer:
      'Conversões fiéis entre formatos Office (DOCX, XLSX, PPTX) e PDF exigem motor dedicado de layout em servidor. Por transparência, esses formatos ficam planejados para uma fase futura dedicada.',
  },
] as const

export default function PDFPage() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center">
      {/* Hero */}
      <section className="text-center mb-8 w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-950 border border-blue-800/60 px-3.5 py-1 text-xs font-semibold text-blue-300 mb-3">
          <Icon name="file" className="h-4 w-4" />
          <span>Processamento local no navegador, sem upload para servidor</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          AgilizaPDF: ferramentas para arquivos PDF
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Organize, converta, assine visualmente, edite e otimize documentos PDF com privacidade e validação local diretamente no navegador.
        </p>
      </section>

      {/* Main Processor Workspace */}
      <section className="w-full">
        <PDFProcessor />
      </section>

      <AdSlot slot="pdf-bottom" className="mt-10" />

      {/* Como usar */}
      <section
        aria-labelledby="pdf-how-to-title"
        className="mt-14 w-full space-y-5 border-t border-slate-800 pt-10 print:hidden"
      >
        <div className="max-w-2xl">
          <h2 id="pdf-how-to-title" className="text-xl font-bold text-white">
            Como usar o AgilizaPDF
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Fluxo simples e transparente para manipular documentos PDF no navegador.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {HOW_TO_STEPS.map((step) => (
            <article
              key={step.title}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-2"
            >
              <h3 className="text-sm font-bold text-white">{step.title}</h3>
              <p className="text-xs leading-relaxed text-slate-400">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Perguntas frequentes */}
      <section
        aria-labelledby="pdf-faq-title"
        className="mt-10 w-full space-y-4 print:hidden"
      >
        <h2 id="pdf-faq-title" className="text-xl font-bold text-white">
          Perguntas frequentes
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FAQ_ITEMS.map((item) => (
            <article
              key={item.question}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-2"
            >
              <h3 className="text-sm font-semibold text-white">
                {item.question}
              </h3>
              <p className="text-xs leading-relaxed text-slate-400">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
