export default function DocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Documentação Agiliza Tools
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Orientações de arquitetura, especificações técnicas e catálogo das ferramentas da rede Agiliza.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Portal Agiliza</h2>
            <p className="mt-1 text-xs text-slate-500">
              Catálogo central e ponto de entrada para as ferramentas.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Monorepo</h2>
            <p className="mt-1 text-xs text-slate-500">
              Estrutura gerenciada por Turborepo com pacotes compartilhados.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
