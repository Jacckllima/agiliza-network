'use client'

import { useState, useMemo } from 'react'
import { TOOLS, Container, Card, Input, Icon } from '@agiliza/ui'

interface CategoryOption {
  id: string
  label: string
  ids?: string[]
}

const CATEGORIES: CategoryOption[] = [
  { id: 'all', label: 'Todas as Ferramentas' },
  { id: 'documentos', label: 'PDF & Documentos', ids: ['pdf', 'nota', 'sign'] },
  { id: 'utilitarios', label: 'Produtividade', ids: ['qr', 'bio', 'text', 'dev'] },
  { id: 'financas', label: 'Finanças & Cálculos', ids: ['calc'] },
  { id: 'midia', label: 'Mídia & Imagem', ids: ['media', 'img'] },
]

export default function Home() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase()
    return TOOLS.filter((tool) => {
      const matchesSearch =
        !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.label.toLowerCase().includes(query)

      if (selectedCategory === 'all') return matchesSearch

      const categoryObj = CATEGORIES.find((c) => c.id === selectedCategory)
      const matchesCategory = categoryObj?.ids?.includes(tool.id)

      return matchesSearch && matchesCategory
    })
  }, [search, selectedCategory])

  return (
    <Container size="xl" className="flex flex-col items-center pt-6 pb-10 sm:pt-8 sm:pb-12">
      {/* Hero Section */}
      <section className="mb-8 flex max-w-3xl flex-col items-center text-center sm:mb-10">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
          Ferramentas para QR Codes, imagens, textos e cálculos
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-500">
          Crie QR Codes, converta imagens, conte palavras, formate JSON e compare cenários financeiros.
        </p>

        {/* Search Input Bar */}
        <div className="relative mt-7 w-full max-w-2xl">
          <div className="relative">
            <Input
              id="search-tools"
              type="text"
              size="md"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Buscar ferramenta (ex: PDF, Pix, CLT vs PJ, JSON...)"
              aria-label="Buscar ferramenta"
              className="rounded-lg pl-11 pr-4 shadow-sm shadow-slate-900/5"
            />
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                aria-label="Limpar busca"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Category Filters */}
        <div className="mt-5 w-full max-w-full overflow-x-auto pb-1 sm:overflow-visible">
          <div className="flex w-max min-w-full justify-start gap-2 sm:w-full sm:flex-wrap sm:justify-center" role="tablist" aria-label="Categorias de ferramentas">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap rounded-md border px-3 py-2 text-[11px] font-semibold transition-colors ${
                  selectedCategory === cat.id
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="mb-10 w-full" aria-label="Lista de ferramentas disponíveis">
        {filteredTools.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center shadow-sm">
            <p className="text-slate-400 text-sm">Nenhuma ferramenta encontrada para "{search}".</p>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSelectedCategory('all')
              }}
              className="mt-3 text-xs font-semibold text-blue-400 hover:underline"
            >
              Ver todas as ferramentas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool) => (
              <a
                key={tool.id}
                href={tool.href}
                className="group relative h-full w-full max-w-[380px]"
              >
                <Card variant="default" padding="none" hoverable className="tool-card flex h-full flex-col rounded-xl border p-2.5">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-800 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300">
                        <Icon name={tool.icon} className="h-4 w-4" />
                      </span>
                    </div>
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-blue-800 transition-colors group-hover:text-blue-600 dark:text-blue-300 dark:group-hover:text-blue-200">
                      {tool.name}
                      <svg
                        className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 text-blue-600 dark:text-blue-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                      {tool.description}
                    </p>
                  </div>

                  <div className="mt-2 flex w-full items-center justify-end gap-1 text-[10px] font-semibold text-blue-800 transition-colors group-hover:text-blue-600 dark:text-blue-300 dark:group-hover:text-blue-200">
                    <span>Acessar ferramenta</span>
                    <svg className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </section>

    </Container>
  )
}
