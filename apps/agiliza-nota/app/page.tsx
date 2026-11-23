import { DocumentGenerator } from '../components/DocumentGenerator'
import { AdSlot, Icon } from '@agiliza/ui'

const HOW_TO_STEPS = [
  {
    title: '1. Escolha o tipo de documento',
    description:
      'Selecione entre Recibo de Pagamento, Declaração de Conteúdo para envios ou NF-e / DANFE na barra de abas.',
  },
  {
    title: '2. Preencha ou envie o arquivo',
    description:
      'Digite os campos com formatação automática de CPF/CNPJ e data, ou envie 1 arquivo XML de NF-e (ou informe a chave de acesso de 44 dígitos).',
  },
  {
    title: '3. Confira a prévia e baixe em PDF',
    description:
      'Revise os dados na folha A4 e clique em Baixar PDF ou Imprimir para gerar o documento sem marcas de navegação.',
  },
] as const

const FAQ_ITEMS = [
  {
    question: 'O AgilizaNota salva meus recibos ou arquivos XML em algum servidor?',
    answer:
      'Não. Recibos, declarações de conteúdo e a conversão de arquivos XML de NF-e em DANFE PDF são processados diretamente na memória do seu navegador. Apenas quando você clica em Consultar pela chave (44 dígitos), a chave informada é enviada pontualmente para a API pública do ConsultaDanfe para localizar o PDF.',
  },
  {
    question: 'O DANFE gerado em PDF substitui o arquivo XML da NF-e?',
    answer:
      'Não. O DANFE é uma representação gráfica auxiliar usada para conferência e acompanhamento de mercadorias. Para fins fiscais e contábeis, guarde sempre o arquivo XML autorizado pela SEFAZ.',
  },
  {
    question: 'Por que a consulta só pela chave de 44 dígitos não encontra notas antigas?',
    answer:
      'A API pública gratuita usada na consulta por chave atende NF-e (modelo 55) emitidas no mês atual (ou no mês anterior até o dia 15). Para notas fiscais mais antigas ou NFC-e (modelo 65), basta enviar o arquivo XML da nota que o DANFE é gerado localmente no navegador.',
  },
  {
    question: 'Quantos documentos ou notas posso baixar por vez?',
    answer:
      'Nesta versão gratuita, o AgilizaNota processa e baixa 1 documento ou 1 nota fiscal por vez, sem necessidade de cadastro.',
  },
] as const

export default function NotaPage() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center print:max-w-none print:p-0">
      <section className="text-center mb-8 w-full flex flex-col items-center print:hidden">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-950 border border-blue-800/60 px-3.5 py-1 text-xs font-semibold text-blue-300 mb-3">
          <Icon name="receipt" className="h-4 w-4" />
          <span>Recibo de pagamento, declaração de conteúdo e DANFE</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          AgilizaNota: recibos, declarações e DANFE em PDF
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Preencha os campos com máscaras e validação em tempo real ou importe um XML de NF-e para gerar e baixar seu documento em formato A4. Processamento local, um documento por vez.
        </p>
      </section>

      <section className="w-full">
        <DocumentGenerator />
      </section>

      <AdSlot slot="nota-bottom" className="mt-10" />

      {/* Como usar */}
      <section
        aria-labelledby="nota-how-to-title"
        className="mt-14 w-full space-y-5 border-t border-slate-800 pt-10 print:hidden"
      >
        <div className="max-w-2xl">
          <h2 id="nota-how-to-title" className="text-xl font-bold text-white">
            Como usar o AgilizaNota
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Passo a passo para gerar recibos, declarações de conteúdo e DANFE de NF-e em PDF.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {HOW_TO_STEPS.map((step) => (
            <article
              key={step.title}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-2"
            >
              <h3 className="text-sm font-bold text-white">{step.title}</h3>
              <p className="text-xs leading-relaxed text-slate-400">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Perguntas frequentes */}
      <section
        aria-labelledby="nota-faq-title"
        className="mt-10 w-full space-y-4 print:hidden"
      >
        <h2 id="nota-faq-title" className="text-xl font-bold text-white">
          Perguntas frequentes
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FAQ_ITEMS.map((item) => (
            <article
              key={item.question}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-2"
            >
              <h3 className="text-sm font-semibold text-white">{item.question}</h3>
              <p className="text-xs leading-relaxed text-slate-400">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
