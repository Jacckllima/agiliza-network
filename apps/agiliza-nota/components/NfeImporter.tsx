'use client'

import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '@agiliza/ui'
import { formatBRL } from '../lib/document-formatters'
import { formatAccessKey, validateAndDecodeAccessKey } from '../lib/nfe-key'
import type { DecodedNfeAccessKey } from '../lib/nfe-key'
import { MAX_NFE_XML_BYTES, parseNfeXml } from '../lib/nfe-xml-parser'
import type { NfeParsedData } from '../lib/nfe-xml-parser'

export interface NfeImporterProps {
  renderActions?: (nfe: NfeParsedData) => ReactNode
}

export function NfeImporter({ renderActions }: NfeImporterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [accessKeyInput, setAccessKeyInput] = useState('')
  const [decodedKey, setDecodedKey] = useState<DecodedNfeAccessKey | null>(null)
  const [parsedNfe, setParsedNfe] = useState<NfeParsedData | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isLookingUp, setIsLookingUp] = useState(false)

  const handleXmlText = (xmlText: string, sourceLabel: string) => {
    try {
      const parsed = parseNfeXml(xmlText)
      setParsedNfe(parsed)
      setAccessKeyInput(parsed.formattedKey)
      const keyCheck = validateAndDecodeAccessKey(parsed.accessKey)
      setDecodedKey(keyCheck.valid ? keyCheck.data : null)
      setErrorMessage('')
      setInfoMessage(`XML carregado com sucesso (${sourceLabel}).`)
    } catch (err) {
      setParsedNfe(null)
      setInfoMessage('')
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao interpretar o arquivo XML.')
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    if (files.length > 1) {
      setErrorMessage(
        'O modo gratuito processa 1 nota fiscal por vez. Selecione apenas 1 arquivo XML.',
      )
      setInfoMessage('')
      return
    }

    const file = files[0]!
    if (file.size > MAX_NFE_XML_BYTES) {
      setErrorMessage('O arquivo excede o limite de 5 MB para processamento seguro no navegador.')
      setInfoMessage('')
      return
    }

    try {
      const text = await file.text()
      handleXmlText(text, file.name)
    } catch {
      setErrorMessage('Não foi possível ler o arquivo selecionado.')
      setInfoMessage('')
    }
  }

  const handleValidateKey = () => {
    setErrorMessage('')
    setInfoMessage('')
    const result = validateAndDecodeAccessKey(accessKeyInput)
    if (!result.valid) {
      setDecodedKey(null)
      setErrorMessage(result.error)
      return
    }
    setDecodedKey(result.data)
    setInfoMessage('Chave de acesso válida (módulo 11). Metadados decodificados localmente.')
  }

  const handleLookupByKey = async () => {
    setErrorMessage('')
    setInfoMessage('')
    const result = validateAndDecodeAccessKey(accessKeyInput)
    if (!result.valid) {
      setDecodedKey(null)
      setErrorMessage(result.error)
      return
    }

    setDecodedKey(result.data)
    setIsLookingUp(true)
    try {
      const response = await fetch('/api/nfe/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: result.data.accessKey }),
      })
      const payload = (await response.json()) as { xml?: string; message?: string }

      if (response.ok && payload.xml) {
        handleXmlText(payload.xml, `Chave ${result.data.numero}`)
        return
      }

      setInfoMessage(
        payload.message ||
          'Consulta automática indisponível no momento. Envie o arquivo XML da NF-e abaixo para continuar.',
      )
    } catch {
      setErrorMessage(
        'Falha ao consultar a chave. Você pode enviar o arquivo XML diretamente para processar no navegador.',
      )
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleClear = () => {
    setAccessKeyInput('')
    setDecodedKey(null)
    setParsedNfe(null)
    setErrorMessage('')
    setInfoMessage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card 1: Upload de XML (1 arquivo por vez) */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400">
              1. Enviar arquivo XML da NF-e
            </h2>
            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
              1 nota por vez
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-400">
            Envie o arquivo <code>.xml</code> autorizado da NF-e ou NFC-e. A leitura acontece
            exclusivamente no seu navegador, sem envio para servidores.
          </p>

          <label
            htmlFor="nfe-xml-upload"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void handleFiles(e.dataTransfer.files)
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/70 p-6 text-center transition-colors hover:border-blue-500"
          >
            <Icon name="file" className="h-6 w-6 text-blue-400" />
            <span className="text-xs font-semibold text-white">
              Clique para selecionar ou arraste 1 arquivo XML aqui
            </span>
            <span className="text-[11px] text-slate-400">Formatos: NF-e (55) e NFC-e (65), até 5 MB</span>
            <input
              ref={fileInputRef}
              id="nfe-xml-upload"
              type="file"
              accept=".xml,application/xml,text/xml"
              onChange={(e) => {
                void handleFiles(e.target.files)
              }}
              className="sr-only"
            />
          </label>
        </div>

        {/* Card 2: Chave de acesso de 44 dígitos */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400">
            2. Ou informar a chave de acesso (44 dígitos)
          </h2>

          <p className="text-xs leading-relaxed text-slate-400">
            Valide o dígito verificador (módulo 11) e decodifique os dados da chave localmente ou
            consulte quando a integração fiscal estiver habilitada.
          </p>

          <div>
            <label htmlFor="nfe-access-key" className="mb-1 block text-xs text-slate-300">
              Chave de acesso da NF-e (44 dígitos)
            </label>
            <input
              id="nfe-access-key"
              type="text"
              inputMode="numeric"
              value={accessKeyInput}
              onChange={(e) => setAccessKeyInput(formatAccessKey(e.target.value))}
              placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLookupByKey}
              disabled={isLookingUp}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
            >
              {isLookingUp ? 'Consultando...' : 'Consultar pela chave'}
            </button>
            <button
              type="button"
              onClick={handleValidateKey}
              className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Validar chave
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Feedback acessível */}
      <div aria-live="polite" className="space-y-2">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-xs text-red-400"
          >
            {errorMessage}
          </div>
        )}
        {infoMessage && (
          <div
            role="status"
            className="rounded-xl border border-blue-500/30 bg-blue-950/30 px-4 py-3 text-xs text-blue-300"
          >
            {infoMessage}
          </div>
        )}
      </div>

      {/* Metadados decodificados da chave */}
      {decodedKey && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Metadados decodificados da chave de acesso
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-slate-400">Modelo</dt>
              <dd className="font-semibold text-white">{decodedKey.modeloLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-400">UF</dt>
              <dd className="font-semibold text-white">
                {decodedKey.ufSigla} ({decodedKey.ufCode})
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Emissão</dt>
              <dd className="font-semibold text-white">{decodedKey.yearMonth}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Série / Número</dt>
              <dd className="font-semibold text-white">
                {decodedKey.serie} / {decodedKey.numero}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">CNPJ do Emitente</dt>
              <dd className="font-mono font-semibold text-white">{decodedKey.emitenteCnpj}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Prévia estruturada do XML importado */}
      {parsedNfe && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-white">
                NF-e Nº {parsedNfe.identificacao.numero} (Série {parsedNfe.identificacao.serie})
              </h3>
              <p className="mt-1 font-mono text-[11px] text-slate-400">{parsedNfe.formattedKey}</p>
            </div>
            {parsedNfe.hasProtocol ? (
              <span className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                Protocolo: {parsedNfe.protocolo?.numero}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
                XML sem protocolo de autorização (protNFe)
              </span>
            )}
          </div>

          {!parsedNfe.hasProtocol && (
            <div
              role="status"
              className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3.5 py-2.5 text-xs text-amber-300"
            >
              Atenção: este XML não contém protocolo de autorização da SEFAZ. O documento tem caráter
              apenas de conferência.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
              <p className="text-[11px] font-bold uppercase text-blue-400">Emitente</p>
              <p className="font-semibold text-white">{parsedNfe.emitente.nome}</p>
              <p className="text-slate-400">CNPJ/CPF: {parsedNfe.emitente.documento}</p>
              {parsedNfe.emitente.ie && <p className="text-slate-400">IE: {parsedNfe.emitente.ie}</p>}
              <p className="text-slate-400">
                {parsedNfe.emitente.endereco.municipio} / {parsedNfe.emitente.endereco.uf}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-1">
              <p className="text-[11px] font-bold uppercase text-blue-400">Destinatário</p>
              <p className="font-semibold text-white">{parsedNfe.destinatario.nome}</p>
              {parsedNfe.destinatario.documento && (
                <p className="text-slate-400">CPF/CNPJ: {parsedNfe.destinatario.documento}</p>
              )}
              {parsedNfe.destinatario.endereco.municipio && (
                <p className="text-slate-400">
                  {parsedNfe.destinatario.endereco.municipio} / {parsedNfe.destinatario.endereco.uf}
                </p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3 text-center">Qtd</th>
                  <th className="py-2 pr-3 text-right">Unit. (R$)</th>
                  <th className="py-2 text-right">Total (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {parsedNfe.itens.map((item) => (
                  <tr key={`${item.numero}-${item.codigo}`}>
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-400">{item.codigo}</td>
                    <td className="py-2 pr-3 text-white">{item.descricao}</td>
                    <td className="py-2 pr-3 text-center text-slate-300">
                      {item.quantidade} {item.unidade}
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-300">
                      {formatBRL(item.valorUnitario)}
                    </td>
                    <td className="py-2 text-right font-semibold text-white">
                      {formatBRL(item.valorTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center">
            <div className="text-xs text-slate-300">
              Valor total da NF-e:{' '}
              <strong className="text-base text-white">R$ {formatBRL(parsedNfe.totais.vNF)}</strong>
            </div>
            {renderActions ? (
              renderActions(parsedNfe)
            ) : (
              <span className="text-[11px] text-slate-400">
                Download do DANFE em PDF será habilitado na próxima entrega (#28).
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
