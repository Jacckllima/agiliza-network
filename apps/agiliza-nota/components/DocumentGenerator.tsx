'use client'

import { useState, useMemo } from 'react'
import { Icon, getPortalHost } from '@agiliza/ui'
import {
  calculateDeclarationTotal,
  formatBRL,
  formatCpfCnpj,
  formatDateInput,
  sanitizePositiveNumber,
  validateDeclaracao,
  validateRecibo,
} from '../lib/document-formatters'
import type { DeclarationItem } from '../lib/document-formatters'
import { downloadDeclaracaoPdf, downloadReciboPdf } from '../lib/pdf-generator'

type DocType = 'recibo' | 'declaracao' | 'nfe'

function getTodayBR(): string {
  return new Date().toLocaleDateString('pt-BR')
}

function createEmptyItem(index: number): DeclarationItem {
  return {
    id: `item-${index}-${Date.now()}`,
    desc: '',
    qtd: 1,
    valor: 0,
  }
}

export function DocumentGenerator() {
  const [docType, setDocType] = useState<DocType>('recibo')
  const [showErrors, setShowErrors] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  // --- Recibo State ---
  const [numeroRecibo, setNumeroRecibo] = useState('0001')
  const [emissorNome, setEmissorNome] = useState('')
  const [emissorDoc, setEmissorDoc] = useState('')
  const [pagadorNome, setPagadorNome] = useState('')
  const [pagadorDoc, setPagadorDoc] = useState('')
  const [valor, setValor] = useState<number>(0)
  const [referente, setReferente] = useState('')
  const [cidade, setCidade] = useState('')
  const [dataDoc, setDataDoc] = useState<string>(getTodayBR)

  // --- Declaração de Conteúdo State ---
  const [remetenteEnd, setRemetenteEnd] = useState('')
  const [destinatarioNome, setDestinatarioNome] = useState('')
  const [destinatarioDoc, setDestinatarioDoc] = useState('')
  const [destinatarioEnd, setDestinatarioEnd] = useState('')
  const [itens, setItens] = useState<DeclarationItem[]>([
    { id: 'item-1', desc: '', qtd: 1, valor: 0 },
  ])

  const totalDeclaracao = useMemo(() => calculateDeclarationTotal(itens), [itens])

  const reciboErrors = useMemo(
    () =>
      validateRecibo({
        numero: numeroRecibo,
        emissorNome,
        emissorDoc,
        pagadorNome,
        pagadorDoc,
        valor,
        referente,
        cidade,
        dataDoc,
      }),
    [numeroRecibo, emissorNome, emissorDoc, pagadorNome, pagadorDoc, valor, referente, cidade, dataDoc],
  )

  const declaracaoErrors = useMemo(
    () =>
      validateDeclaracao({
        remetenteNome: emissorNome,
        remetenteDoc: emissorDoc,
        remetenteEnd,
        destinatarioNome,
        destinatarioDoc,
        destinatarioEnd,
        cidade,
        dataDoc,
        itens,
      }),
    [emissorNome, emissorDoc, remetenteEnd, destinatarioNome, destinatarioDoc, destinatarioEnd, cidade, dataDoc, itens],
  )

  const currentErrors = docType === 'recibo' ? reciboErrors : declaracaoErrors
  const hasErrors = Object.keys(currentErrors).length > 0

  const handleTabChange = (nextTab: DocType) => {
    setDocType(nextTab)
    setShowErrors(false)
    setStatusMessage('')
  }

  const handleAddItem = () => {
    setItens((prev) => [...prev, createEmptyItem(prev.length + 1)])
  }

  const handleUpdateItem = (
    id: string,
    field: keyof Omit<DeclarationItem, 'id'>,
    rawValue: string,
  ) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        if (field === 'desc') return { ...item, desc: rawValue }
        return { ...item, [field]: sanitizePositiveNumber(Number(rawValue)) }
      }),
    )
  }

  const handleRemoveItem = (id: string) => {
    setItens((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev))
  }

  const handleClearForm = () => {
    setShowErrors(false)
    if (docType === 'recibo') {
      setNumeroRecibo('0001')
      setEmissorNome('')
      setEmissorDoc('')
      setPagadorNome('')
      setPagadorDoc('')
      setValor(0)
      setReferente('')
      setCidade('')
      setDataDoc(getTodayBR())
      setStatusMessage('Campos do recibo limpos.')
    } else if (docType === 'declaracao') {
      setEmissorNome('')
      setEmissorDoc('')
      setRemetenteEnd('')
      setDestinatarioNome('')
      setDestinatarioDoc('')
      setDestinatarioEnd('')
      setCidade('')
      setDataDoc(getTodayBR())
      setItens([{ id: 'item-1', desc: '', qtd: 1, valor: 0 }])
      setStatusMessage('Campos da declaração limpos.')
    }
  }

  const [isExporting, setIsExporting] = useState(false)

  const handleDownloadPdf = () => {
    if (docType === 'nfe') return
    setShowErrors(true)
    if (hasErrors) {
      setStatusMessage('Revise os campos obrigatórios destacados antes de baixar o PDF.')
      return
    }

    setIsExporting(true)
    try {
      const host = getPortalHost()
      const filename =
        docType === 'recibo'
          ? downloadReciboPdf(
              {
                numero: numeroRecibo,
                emissorNome,
                emissorDoc,
                pagadorNome,
                pagadorDoc,
                valor,
                referente,
                cidade,
                dataDoc,
              },
              host,
            )
          : downloadDeclaracaoPdf(
              {
                remetenteNome: emissorNome,
                remetenteDoc: emissorDoc,
                remetenteEnd,
                destinatarioNome,
                destinatarioDoc,
                destinatarioEnd,
                cidade,
                dataDoc,
                itens,
              },
              host,
            )
      setStatusMessage(`PDF gerado e baixado: ${filename}`)
    } catch {
      setStatusMessage('Não foi possível gerar o PDF. Tente novamente ou use a opção Imprimir.')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrint = () => {
    if (docType === 'nfe') return
    setShowErrors(true)
    if (hasErrors) {
      setStatusMessage('Revise os campos obrigatórios destacados antes de imprimir.')
      return
    }
    setStatusMessage('Abrindo caixa de impressão do navegador.')
    window.print()
  }

  const inputClass =
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  return (
    <div className="w-full space-y-6">
      {/* Tab Bar */}
      <div
        role="tablist"
        aria-label="Tipo de documento"
        className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:grid-cols-3 print:hidden"
      >
        {(
          [
            { id: 'recibo', label: 'Recibo de Pagamento', icon: 'receipt' },
            { id: 'declaracao', label: 'Declaração de Conteúdo', icon: 'box' },
            { id: 'nfe', label: 'NF-e / DANFE', icon: 'file' },
          ] as const
        ).map((tab) => {
          const isSelected = docType === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Icon name={tab.icon} className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* NF-e / DANFE Tab (placeholder honesto até #27/#28) */}
      {docType === 'nfe' ? (
        <div
          role="status"
          className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8"
        >
          <div className="flex items-start gap-3">
            <Icon name="file" className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-white">
                Importação de XML e geração de DANFE em PDF em desenvolvimento
              </h2>
              <p className="text-xs leading-relaxed text-slate-400">
                Esta aba receberá o envio de arquivo XML de NF-e (um arquivo por vez no modo gratuito)
                e a validação de chave de acesso de 44 dígitos para gerar o DANFE em PDF.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Editor Column */}
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl lg:col-span-6 print:hidden">
            {docType === 'recibo' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    Dados do Recibo
                  </h2>
                  <div className="flex items-center gap-2">
                    <label htmlFor="recibo-numero" className="text-[11px] text-slate-400">
                      Nº
                    </label>
                    <input
                      id="recibo-numero"
                      type="text"
                      value={numeroRecibo}
                      onChange={(e) => setNumeroRecibo(e.target.value.slice(0, 12))}
                      className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-right font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="recibo-emissor-nome" className="mb-1 block text-xs text-slate-300">
                      Nome de quem recebeu (Emissor) *
                    </label>
                    <input
                      id="recibo-emissor-nome"
                      type="text"
                      value={emissorNome}
                      onChange={(e) => setEmissorNome(e.target.value)}
                      placeholder="Ex: Maria Souza"
                      aria-invalid={showErrors && Boolean(reciboErrors.emissorNome)}
                      className={inputClass}
                    />
                    {showErrors && reciboErrors.emissorNome && (
                      <p className="mt-1 text-[11px] text-red-400">{reciboErrors.emissorNome}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="recibo-emissor-doc" className="mb-1 block text-xs text-slate-300">
                      CPF/CNPJ do Emissor
                    </label>
                    <input
                      id="recibo-emissor-doc"
                      type="text"
                      inputMode="numeric"
                      value={emissorDoc}
                      onChange={(e) => setEmissorDoc(formatCpfCnpj(e.target.value))}
                      placeholder="000.000.000-00"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="recibo-pagador-nome" className="mb-1 block text-xs text-slate-300">
                      Nome de quem pagou (Pagador) *
                    </label>
                    <input
                      id="recibo-pagador-nome"
                      type="text"
                      value={pagadorNome}
                      onChange={(e) => setPagadorNome(e.target.value)}
                      placeholder="Ex: João Silva"
                      aria-invalid={showErrors && Boolean(reciboErrors.pagadorNome)}
                      className={inputClass}
                    />
                    {showErrors && reciboErrors.pagadorNome && (
                      <p className="mt-1 text-[11px] text-red-400">{reciboErrors.pagadorNome}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="recibo-pagador-doc" className="mb-1 block text-xs text-slate-300">
                      CPF/CNPJ do Pagador
                    </label>
                    <input
                      id="recibo-pagador-doc"
                      type="text"
                      inputMode="numeric"
                      value={pagadorDoc}
                      onChange={(e) => setPagadorDoc(formatCpfCnpj(e.target.value))}
                      placeholder="000.000.000-00"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="recibo-valor" className="mb-1 block text-xs text-slate-300">
                      Valor Recebido (R$) *
                    </label>
                    <input
                      id="recibo-valor"
                      type="number"
                      min={0}
                      step="0.01"
                      value={valor}
                      onChange={(e) => setValor(sanitizePositiveNumber(Number(e.target.value)))}
                      aria-invalid={showErrors && Boolean(reciboErrors.valor)}
                      className={`${inputClass} font-bold text-emerald-400`}
                    />
                    {showErrors && reciboErrors.valor && (
                      <p className="mt-1 text-[11px] text-red-400">{reciboErrors.valor}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="recibo-cidade" className="mb-1 block text-xs text-slate-300">
                      Cidade / UF
                    </label>
                    <input
                      id="recibo-cidade"
                      type="text"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: São Paulo / SP"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="recibo-data" className="mb-1 block text-xs text-slate-300">
                      Data
                    </label>
                    <input
                      id="recibo-data"
                      type="text"
                      inputMode="numeric"
                      value={dataDoc}
                      onChange={(e) => setDataDoc(formatDateInput(e.target.value))}
                      placeholder="DD/MM/AAAA"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="recibo-referente" className="mb-1 block text-xs text-slate-300">
                    Referente a (Descrição) *
                  </label>
                  <textarea
                    id="recibo-referente"
                    rows={3}
                    value={referente}
                    onChange={(e) => setReferente(e.target.value)}
                    placeholder="Ex: Prestação de serviços de consultoria em novembro de 2026"
                    aria-invalid={showErrors && Boolean(reciboErrors.referente)}
                    className={`${inputClass} resize-y`}
                  />
                  {showErrors && reciboErrors.referente && (
                    <p className="mt-1 text-[11px] text-red-400">{reciboErrors.referente}</p>
                  )}
                </div>
              </div>
            )}

            {docType === 'declaracao' && (
              <div className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Dados da Declaração de Conteúdo
                </h2>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="decl-rem-nome" className="mb-1 block text-xs text-slate-300">
                      Nome do Remetente *
                    </label>
                    <input
                      id="decl-rem-nome"
                      type="text"
                      value={emissorNome}
                      onChange={(e) => setEmissorNome(e.target.value)}
                      aria-invalid={showErrors && Boolean(declaracaoErrors.remetenteNome)}
                      className={inputClass}
                    />
                    {showErrors && declaracaoErrors.remetenteNome && (
                      <p className="mt-1 text-[11px] text-red-400">{declaracaoErrors.remetenteNome}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="decl-rem-doc" className="mb-1 block text-xs text-slate-300">
                      CPF/CNPJ do Remetente
                    </label>
                    <input
                      id="decl-rem-doc"
                      type="text"
                      inputMode="numeric"
                      value={emissorDoc}
                      onChange={(e) => setEmissorDoc(formatCpfCnpj(e.target.value))}
                      placeholder="000.000.000-00"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="decl-rem-end" className="mb-1 block text-xs text-slate-300">
                    Endereço do Remetente *
                  </label>
                  <input
                    id="decl-rem-end"
                    type="text"
                    value={remetenteEnd}
                    onChange={(e) => setRemetenteEnd(e.target.value)}
                    aria-invalid={showErrors && Boolean(declaracaoErrors.remetenteEnd)}
                    className={inputClass}
                  />
                  {showErrors && declaracaoErrors.remetenteEnd && (
                    <p className="mt-1 text-[11px] text-red-400">{declaracaoErrors.remetenteEnd}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="decl-dest-nome" className="mb-1 block text-xs text-slate-300">
                      Nome do Destinatário *
                    </label>
                    <input
                      id="decl-dest-nome"
                      type="text"
                      value={destinatarioNome}
                      onChange={(e) => setDestinatarioNome(e.target.value)}
                      aria-invalid={showErrors && Boolean(declaracaoErrors.destinatarioNome)}
                      className={inputClass}
                    />
                    {showErrors && declaracaoErrors.destinatarioNome && (
                      <p className="mt-1 text-[11px] text-red-400">{declaracaoErrors.destinatarioNome}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="decl-dest-doc" className="mb-1 block text-xs text-slate-300">
                      CPF/CNPJ do Destinatário
                    </label>
                    <input
                      id="decl-dest-doc"
                      type="text"
                      inputMode="numeric"
                      value={destinatarioDoc}
                      onChange={(e) => setDestinatarioDoc(formatCpfCnpj(e.target.value))}
                      placeholder="000.000.000-00"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="decl-dest-end" className="mb-1 block text-xs text-slate-300">
                    Endereço do Destinatário *
                  </label>
                  <input
                    id="decl-dest-end"
                    type="text"
                    value={destinatarioEnd}
                    onChange={(e) => setDestinatarioEnd(e.target.value)}
                    aria-invalid={showErrors && Boolean(declaracaoErrors.destinatarioEnd)}
                    className={inputClass}
                  />
                  {showErrors && declaracaoErrors.destinatarioEnd && (
                    <p className="mt-1 text-[11px] text-red-400">{declaracaoErrors.destinatarioEnd}</p>
                  )}
                </div>

                {/* Itens dinâmicos */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">Itens declarados *</span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                    >
                      Adicionar item
                    </button>
                  </div>

                  {itens.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 items-end gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5"
                    >
                      <div className="col-span-6">
                        <label htmlFor={`item-desc-${item.id}`} className="mb-1 block text-[11px] text-slate-400">
                          Descrição #{idx + 1}
                        </label>
                        <input
                          id={`item-desc-${item.id}`}
                          type="text"
                          value={item.desc}
                          onChange={(e) => handleUpdateItem(item.id, 'desc', e.target.value)}
                          placeholder="Ex: Livro técnico"
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-2">
                        <label htmlFor={`item-qtd-${item.id}`} className="mb-1 block text-[11px] text-slate-400">
                          Qtd
                        </label>
                        <input
                          id={`item-qtd-${item.id}`}
                          type="number"
                          min={0}
                          value={item.qtd}
                          onChange={(e) => handleUpdateItem(item.id, 'qtd', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-3">
                        <label htmlFor={`item-valor-${item.id}`} className="mb-1 block text-[11px] text-slate-400">
                          Unit. (R$)
                        </label>
                        <input
                          id={`item-valor-${item.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.valor}
                          onChange={(e) => handleUpdateItem(item.id, 'valor', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={itens.length <= 1}
                          aria-label={`Remover item ${idx + 1}`}
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                  {showErrors && declaracaoErrors.itens && (
                    <p className="text-[11px] text-red-400">{declaracaoErrors.itens}</p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-60"
              >
                <Icon name="download" className="h-4 w-4" />
                <span>{isExporting ? 'Gerando PDF...' : 'Baixar PDF'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <Icon name="printer" className="h-4 w-4" />
                <span>Imprimir</span>
              </button>
              <button
                type="button"
                onClick={handleClearForm}
                className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Limpar
              </button>
            </div>

            <div aria-live="polite" className="min-h-[18px] text-xs">
              {statusMessage && (
                <p className={showErrors && hasErrors ? 'text-red-400' : 'text-blue-300'}>
                  {statusMessage}
                </p>
              )}
            </div>
          </div>

          {/* Printable Preview Column */}
          <div className="flex flex-col items-center lg:col-span-6">
            <span className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400 print:hidden">
              Pré-visualização da folha A4
            </span>

            <div className="flex min-h-[600px] w-full max-w-[540px] flex-col justify-between rounded-xl border border-slate-300 bg-white p-6 text-slate-900 shadow-2xl sm:p-8 print:m-0 print:w-full print:max-w-none print:border-none print:shadow-none">
              {docType === 'recibo' ? (
                <div className="space-y-6">
                  <div className="border-b-2 border-slate-900 pb-4 text-center">
                    <h2 className="text-xl font-extrabold uppercase tracking-widest text-slate-900">
                      RECIBO DE PAGAMENTO
                    </h2>
                    <span className="text-sm font-bold text-slate-700">
                      Nº {numeroRecibo || '0001'}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-300 bg-slate-100 p-4 text-right">
                    <span className="block text-xs font-bold text-slate-600">VALOR RECEBIDO</span>
                    <span className="text-2xl font-black text-slate-900">
                      R$ {formatBRL(valor)}
                    </span>
                  </div>

                  <p className="break-words font-serif text-xs leading-relaxed text-slate-800">
                    Recebi(emos) de <strong className="uppercase">{pagadorNome || '________________________'}</strong>
                    {pagadorDoc ? ` (CPF/CNPJ: ${pagadorDoc})` : ''} a quantia de{' '}
                    <strong className="underline">R$ {formatBRL(valor)}</strong>, referente a:{' '}
                    {referente || '________________________________________________'}.
                  </p>

                  <p className="text-xs text-slate-700">
                    Para clareza e fins de direito, firmo(amos) o presente recibo.
                  </p>

                  <p className="pt-4 text-right text-xs text-slate-600">
                    {cidade || 'Cidade / UF'}, {dataDoc || getTodayBR()}
                  </p>

                  <div className="pt-16 text-center">
                    <div className="mx-auto w-72 border-t border-slate-900 pt-2">
                      <p className="text-xs font-bold text-slate-900">
                        {emissorNome || 'Assinatura do Emissor'}
                      </p>
                      {emissorDoc && <p className="text-[10px] text-slate-600">{emissorDoc}</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-b-2 border-slate-900 pb-2 text-center">
                    <h2 className="text-base font-bold uppercase text-slate-900">
                      DECLARAÇÃO DE CONTEÚDO
                    </h2>
                  </div>

                  <div className="space-y-1.5 break-words text-[11px]">
                    <p>
                      <strong>REMETENTE:</strong> {emissorNome || '________________'}
                      {emissorDoc ? ` (${emissorDoc})` : ''}
                      {remetenteEnd ? `, ${remetenteEnd}` : ''}
                    </p>
                    <p>
                      <strong>DESTINATÁRIO:</strong> {destinatarioNome || '________________'}
                      {destinatarioDoc ? ` (${destinatarioDoc})` : ''}
                      {destinatarioEnd ? `, ${destinatarioEnd}` : ''}
                    </p>
                  </div>

                  <table className="mt-4 w-full border-collapse border border-slate-300 text-left text-[10px]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 p-1.5">Item / Conteúdo</th>
                        <th className="w-12 border border-slate-300 p-1.5 text-center">Qtd</th>
                        <th className="w-24 border border-slate-300 p-1.5 text-right">Subtotal (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it) => (
                        <tr key={it.id}>
                          <td className="break-words border border-slate-300 p-1.5">
                            {it.desc || 'Item sem descrição'}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-center">{it.qtd}</td>
                          <td className="border border-slate-300 p-1.5 text-right">
                            {formatBRL(it.qtd * it.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="pt-2 text-right text-xs font-bold">
                    TOTAL DECLARADO: R$ {formatBRL(totalDeclaracao)}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-6 text-center text-[9px] text-slate-500">
                Documento auxiliar gerado via AgilizaNota ({getPortalHost()}). A veracidade dos dados é de responsabilidade do emitente.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
