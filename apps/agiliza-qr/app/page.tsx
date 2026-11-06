import { Suspense } from 'react'
import { QRGenerator } from '../components/QRGenerator'
import { Icon } from '@agiliza/ui'

// FAQ Data
const FAQ_ITEMS = [
  {
    q: 'O que é um QR Code e para que serve?',
    a: 'É uma imagem que codifica informações para leitura por um dispositivo compatível. Pode conter links, dados de acesso a redes Wi-Fi, informações de contato, texto ou dados para pagamentos Pix.',
  },
  {
    q: 'Como gerar um QR Code para Pix?',
    a: 'Selecione Pix e preencha a chave, o nome do recebedor e a cidade. Valor e descrição são opcionais. Confira as informações no aplicativo do banco antes de compartilhar o código.',
  },
  {
    q: 'Um QR Code estático expira?',
    a: 'A imagem não tem uma expiração configurada nesta ferramenta. Se ela contiver um link, o destino ainda pode deixar de funcionar ou mudar.',
  },
  {
    q: 'Posso personalizar as cores e margens?',
    a: 'Você pode ajustar a cor dos módulos, a cor do fundo e a margem. Confira o contraste com um leitor antes de imprimir ou compartilhar o código.',
  },
  {
    q: 'Qual a diferença entre PNG e SVG?',
    a: 'PNG é uma imagem rasterizada. SVG é vetorial e pode ser ampliado sem a pixelização típica de imagens rasterizadas. O resultado impresso também depende do tamanho e da qualidade do material.',
  },
]

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function QRSkeleton() {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-xs animate-pulse">
      <div className="h-8 w-60 bg-slate-100 rounded-lg mx-auto mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3">
          <div className="h-8 bg-slate-100 rounded-lg" />
          <div className="h-8 bg-slate-100 rounded-lg" />
          <div className="h-8 bg-slate-100 rounded-lg" />
        </div>
        <div className="lg:col-span-5 h-64 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QRPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center">
      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <section className="text-center mb-8 w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/60 px-3.5 py-1 text-xs font-semibold text-blue-700 mb-3 shadow-2xs">
          <Icon name="bolt" className="h-4 w-4" />
          <span>Pix, Wi-Fi, links, texto e contatos</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Gerador de QR Code
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
          Gere QR Codes para Pix, Wi-Fi, links, texto e contatos. Personalize cores e margem e exporte em PNG ou SVG.
        </p>
      </section>

      {/* ── Main Tool Workspace ────────────────────────────────────────────── */}
      <section id="gerador-qr-code" aria-label="Ferramenta de QR Code" className="w-full">
        <Suspense fallback={<QRSkeleton />}>
          <QRGenerator />
        </Suspense>
      </section>

      {/* ── How It Works (3 Steps) ─────────────────────────────────────────── */}
      <section className="my-10" aria-label="Como gerar QR Code em 3 passos">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-slate-900">
            Como gerar seu QR Code em 3 passos simples
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Escolha um tipo de conteúdo, preencha os campos e baixe o arquivo gerado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              step: '1',
              title: 'Escolha o tipo',
              desc: 'Selecione Pix, Link, Wi-Fi, Texto, Contato ou VCard.',
            },
            {
              step: '2',
              title: 'Preencha os dados',
              desc: 'Insira as informações e personalize a cor do código e fundo.',
            },
            {
              step: '3',
              title: 'Baixe o arquivo',
              desc: 'Escolha PNG ou SVG para salvar o QR Code gerado.',
            },
          ].map(item => (
            <div
              key={item.step}
              className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-xs flex flex-col items-center"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs mb-2 shadow-xs">
                {item.step}
              </div>
              <h3 className="text-xs font-bold text-slate-900 mb-0.5">{item.title}</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ & SEO Section ──────────────────────────────────────────────── */}
      <section id="faq" className="my-10 w-full" aria-label="Perguntas Frequentes e Informações">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-slate-900">
            Perguntas Frequentes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tire suas dúvidas sobre criação e personalização de QR Codes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FAQ_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs"
            >
              <h3 className="text-xs font-bold text-slate-900 mb-1">{item.q}</h3>
              <p className="text-xs leading-relaxed text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>

        {/* Semantic SEO Block */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-600 shadow-xs space-y-2">
          <h3 className="text-xs font-bold text-slate-900">
            Sobre o AgilizaQR: gerador de QR Codes
          </h3>
          <p>
            No <strong className="text-slate-800">AgilizaQR</strong>, selecione um tipo de conteúdo, preencha os campos e confira o código gerado. Os tipos disponíveis incluem Pix, Wi-Fi, links, texto e contatos.
          </p>
          <p>
            O código inclui as informações preenchidas no formulário. Confira o conteúdo e o destino antes de compartilhar. O download está disponível em <strong className="text-slate-800">PNG</strong> e <strong className="text-slate-800">SVG</strong>.
          </p>
        </div>
      </section>
    </div>
  )
}
