'use client'

import { useState } from 'react'
import { Icon, type IconName } from '@agiliza/ui'
import { FileDropzone } from './FileDropzone'
import { formatFileSize } from '../lib/file-validation'
import { inspectPdfBytes } from '../lib/pdf-operations'
import {
  compressPdfVisually,
  optimizePdfStructurally,
  VISUAL_QUALITY_PRESETS,
  type PdfOptimizationResult,
  type VisualCompressionQuality,
} from '../lib/pdf-optimize'
import { MAX_RENDER_PAGES, stripPdfExtension } from '../lib/pdf-to-media'
import { downloadBytesAsFile } from '../lib/browser-download'

type OptimizeMode = 'structural' | 'visual'

interface LoadedOptimizePdf {
  file: File
  bytes: Uint8Array
  pageCount: number
}

const MODE_OPTIONS = [
  {
    id: 'structural' as const,
    label: 'Otimização estrutural (preserva texto)',
    icon: 'bolt' as IconName,
    description:
      'Regrava o PDF com object streams e remove metadados redundantes mantendo 100% do texto selecionável.',
  },
  {
    id: 'visual' as const,
    label: 'Compressão visual (recompressão JPEG)',
    icon: 'image' as IconName,
    description:
      'Converte cada página em JPEG com qualidade ajustável para reduzir PDFs pesados com muitas imagens.',
  },
] as const

const QUALITY_ORDER: readonly VisualCompressionQuality[] = [
  'low',
  'medium',
  'high',
]

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer())
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result))
      } else {
        reject(new Error('Falha ao ler os bytes do arquivo.'))
      }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo local.'))
    reader.readAsArrayBuffer(file)
  })
}

export function OptimizePdfPanel() {
  const [mode, setMode] = useState<OptimizeMode>('structural')
  const [sourcePdf, setSourcePdf] = useState<LoadedOptimizePdf | null>(null)
  const [stripMetadata, setStripMetadata] = useState(true)
  const [visualQuality, setVisualQuality] =
    useState<VisualCompressionQuality>('medium')

  const [progress, setProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [result, setResult] = useState<PdfOptimizationResult | null>(null)

  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const clearFeedback = () => {
    setErrorMessage('')
    setStatusMessage('')
  }

  const handleFileChange = async (files: File[]) => {
    clearFeedback()
    setResult(null)
    setProgress(null)
    const file = files[0]
    if (!file) {
      setSourcePdf(null)
      return
    }
    setIsBusy(true)
    try {
      const bytes = await readFileBytes(file)
      const { pageCount } = await inspectPdfBytes(bytes)
      setSourcePdf({ file, bytes, pageCount })
    } catch (err) {
      setSourcePdf(null)
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o PDF para otimização.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleModeChange = (nextMode: OptimizeMode) => {
    setMode(nextMode)
    setResult(null)
    clearFeedback()
  }

  const handleOptimize = async () => {
    clearFeedback()
    setResult(null)
    setProgress(null)
    if (!sourcePdf) {
      setErrorMessage('Envie 1 arquivo PDF antes de iniciar a otimização.')
      return
    }

    setIsBusy(true)
    try {
      const output =
        mode === 'structural'
          ? await optimizePdfStructurally(sourcePdf.bytes, { stripMetadata })
          : await compressPdfVisually(sourcePdf.bytes, {
              quality: visualQuality,
              onProgress: (current, total) => setProgress({ current, total }),
            })

      setResult(output)

      if (output.stats.reduced) {
        setStatusMessage(
          `Otimização concluída com redução real de ${formatFileSize(output.stats.savedBytes)} (${output.stats.savedPercent.toFixed(1).replace('.', ',')}%). Clique abaixo para baixar o arquivo otimizado.`,
        )
      } else {
        setStatusMessage(
          'Este PDF já estava altamente otimizado e o arquivo resultante não ficou menor que o original. Você pode testar a compressão visual ou manter o arquivo original.',
        )
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao otimizar o PDF.',
      )
    } finally {
      setProgress(null)
      setIsBusy(false)
    }
  }

  const handleDownloadResult = () => {
    if (!sourcePdf || !result) return
    const base = stripPdfExtension(sourcePdf.file.name)
    const suffix = result.mode === 'structural' ? 'otimizado' : 'comprimido'
    const filename = `${base}-${suffix}.pdf`
    downloadBytesAsFile(result.bytes, filename)
    setStatusMessage(`Download de ${filename} iniciado.`)
  }

  const currentModeInfo =
    MODE_OPTIONS.find((item) => item.id === mode) ?? MODE_OPTIONS[0]

  return (
    <div className="space-y-6">
      {/* Seletor de modo */}
      <div
        role="group"
        aria-label="Escolha o método de otimização do PDF"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {MODE_OPTIONS.map((option) => {
          const active = option.id === mode
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => handleModeChange(option.id)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60 hover:text-white'
              }`}
            >
              <Icon name={option.icon} className="h-4 w-4 shrink-0" />
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>

      <p className="text-sm text-slate-400">{currentModeInfo.description}</p>

      {/* Upload de 1 PDF */}
      <FileDropzone
        id="dropzone-optimize-pdf"
        label="Envie 1 arquivo PDF para otimizar"
        helperText="Formato .pdf, 1 arquivo por vez, limite seguro de 25 MB."
        allowedExtensions={['.pdf']}
        accept=".pdf,application/pdf"
        multiple={false}
        maxFiles={1}
        files={sourcePdf ? [sourcePdf.file] : []}
        onFilesChange={handleFileChange}
        hideFileList
      />

      {sourcePdf && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-xs">
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              {sourcePdf.file.name}
            </p>
            <p className="text-slate-400">
              {sourcePdf.pageCount}{' '}
              {sourcePdf.pageCount === 1 ? 'página' : 'páginas'} • Tamanho original:{' '}
              {formatFileSize(sourcePdf.bytes.byteLength)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSourcePdf(null)
              setResult(null)
              clearFeedback()
            }}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-red-500 hover:text-red-300"
          >
            Trocar PDF
          </button>
        </div>
      )}

      {/* Opções do modo estrutural */}
      {mode === 'structural' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
          <label
            htmlFor="optimize-strip-metadata"
            className="flex items-center gap-2 text-xs text-slate-300"
          >
            <input
              id="optimize-strip-metadata"
              type="checkbox"
              checked={stripMetadata}
              onChange={(event) => setStripMetadata(event.target.checked)}
              className="h-4 w-4 rounded border-slate-600 accent-blue-600"
            />
            <span>
              Remover metadados redundantes (produtor, autor, assunto e palavras-chave)
            </span>
          </label>
        </div>
      )}

      {/* Opções do modo visual */}
      {mode === 'visual' && (
        <div className="space-y-4">
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
          >
            <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="leading-relaxed">
              Transparência: na compressão visual, cada página é regravada como imagem JPEG para reduzir arquivos com muitas fotos. O texto deixa de ser selecionável nesse modo (limite de {MAX_RENDER_PAGES} páginas por operação).
            </p>
          </div>

          <div>
            <span className="block text-xs font-semibold text-white">
              Qualidade da recompressão JPEG
            </span>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {QUALITY_ORDER.map((key) => {
                const preset = VISUAL_QUALITY_PRESETS[key]
                const active = visualQuality === key
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setVisualQuality(key)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {progress && (
        <div
          role="status"
          className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs"
        >
          <div className="flex items-center justify-between text-slate-200">
            <span>
              Recompactando página {progress.current} de {progress.total}...
            </span>
            <span className="font-semibold text-blue-400">
              {Math.round((progress.current / progress.total) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{
                width: `${Math.round((progress.current / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleOptimize}
          disabled={isBusy || !sourcePdf}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="bolt" className="h-4 w-4" />
          <span>
            {isBusy
              ? 'Processando PDF...'
              : mode === 'structural'
                ? 'Otimizar PDF estruturalmente'
                : 'Comprimir PDF visualmente'}
          </span>
        </button>
      </div>

      {/* Comparativo real de tamanho */}
      {result && (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-bold text-white">
            Comparativo real de tamanho
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <p className="text-[11px] text-slate-400">Tamanho original</p>
              <p className="mt-1 text-base font-bold text-white">
                {formatFileSize(result.stats.originalBytes)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <p className="text-[11px] text-slate-400">Tamanho resultante</p>
              <p className="mt-1 text-base font-bold text-white">
                {formatFileSize(result.stats.optimizedBytes)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
              <p className="text-[11px] text-slate-400">Resultado real</p>
              <p
                className={`mt-1 text-base font-bold ${
                  result.stats.reduced ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {result.stats.reduced
                  ? `-${formatFileSize(result.stats.savedBytes)} (${result.stats.savedPercent.toFixed(1).replace('.', ',')}%)`
                  : 'Sem redução de tamanho'}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleDownloadResult}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                result.stats.reduced
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'border border-slate-700 bg-slate-950 text-slate-200 hover:border-blue-500'
              }`}
            >
              <Icon name="download" className="h-4 w-4" />
              <span>
                {result.stats.reduced
                  ? 'Baixar PDF otimizado'
                  : 'Baixar cópia regravada mesmo assim'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Feedback acessível */}
      <div aria-live="polite" className="space-y-2">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300"
          >
            <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {statusMessage && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}
