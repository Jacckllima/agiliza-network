'use client'

import { useState } from 'react'
import { Icon, type IconName } from '@agiliza/ui'
import { FileDropzone } from './FileDropzone'
import { formatFileSize, MAX_MERGE_FILES } from '../lib/file-validation'
import {
  extractPdfPages,
  inspectPdfBytes,
  mergePdfDocuments,
  parsePageRange,
  removePdfPages,
  rotatePdfPages,
  type RotationAngle,
} from '../lib/pdf-operations'
import { downloadBytesAsFile } from '../lib/browser-download'

type OrganizeMode = 'merge' | 'split' | 'rotate' | 'remove'

interface LoadedPdfItem {
  id: string
  file: File
  bytes: Uint8Array
  pageCount: number
}

interface ModeOption {
  id: OrganizeMode
  label: string
  icon: IconName
  description: string
}

const MODE_OPTIONS = [
  {
    id: 'merge',
    label: 'Juntar PDFs',
    icon: 'plus',
    description:
      'Combine de 2 a 15 arquivos PDF na ordem desejada em um único arquivo.',
  },
  {
    id: 'split',
    label: 'Dividir e extrair',
    icon: 'scissors',
    description:
      'Extraia páginas específicas ou intervalos (ex.: 1-3, 5, 8-10) para um novo PDF.',
  },
  {
    id: 'rotate',
    label: 'Girar páginas',
    icon: 'rotate',
    description:
      'Gire todas as páginas ou apenas páginas escolhidas em 90°, 180° ou 270°.',
  },
  {
    id: 'remove',
    label: 'Remover páginas',
    icon: 'x',
    description:
      'Exclua páginas indesejadas de um PDF mantendo o restante intacto.',
  },
] as const satisfies readonly ModeOption[]

const ROTATION_ANGLES: readonly RotationAngle[] = [90, 180, 270]

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result))
      } else {
        reject(new Error('Não foi possível ler os bytes do arquivo.'))
      }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo local.'))
    reader.readAsArrayBuffer(file)
  })
}

export function OrganizePdfPanel() {
  const [mode, setMode] = useState<OrganizeMode>('merge')
  const [mergeItems, setMergeItems] = useState<LoadedPdfItem[]>([])
  const [singleItem, setSingleItem] = useState<LoadedPdfItem | null>(null)

  const [splitRange, setSplitRange] = useState('')
  const [rotateAngle, setRotateAngle] = useState<RotationAngle>(90)
  const [rotateRange, setRotateRange] = useState('')
  const [removeRange, setRemoveRange] = useState('')

  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const clearFeedback = () => {
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleModeChange = (nextMode: OrganizeMode) => {
    setMode(nextMode)
    clearFeedback()
  }

  const handleMergeFilesChange = async (nextFiles: File[]) => {
    clearFeedback()
    setIsBusy(true)
    try {
      const loaded: LoadedPdfItem[] = []
      const failed: string[] = []

      for (const file of nextFiles) {
        const existing = mergeItems.find(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified,
        )
        if (existing) {
          loaded.push(existing)
          continue
        }

        try {
          const bytes = await readFileBytes(file)
          const { pageCount } = await inspectPdfBytes(bytes)
          loaded.push({
            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            bytes,
            pageCount,
          })
        } catch (err) {
          const reason =
            err instanceof Error ? err.message : 'Arquivo PDF inválido.'
          failed.push(`${file.name}: ${reason}`)
        }
      }

      setMergeItems(loaded)
      if (failed.length > 0) {
        setErrorMessage(failed.join(' '))
      }
    } finally {
      setIsBusy(false)
    }
  }

  const handleSingleFileChange = async (nextFiles: File[]) => {
    clearFeedback()
    const file = nextFiles[0]
    if (!file) {
      setSingleItem(null)
      return
    }

    setIsBusy(true)
    try {
      const bytes = await readFileBytes(file)
      const { pageCount } = await inspectPdfBytes(bytes)
      setSingleItem({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        bytes,
        pageCount,
      })
    } catch (err) {
      setSingleItem(null)
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o arquivo PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const moveMergeItem = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= mergeItems.length) return
    setMergeItems((prev) => {
      const copy = [...prev]
      const current = copy[index]
      const swapped = copy[target]
      if (!current || !swapped) return prev
      copy[index] = swapped
      copy[target] = current
      return copy
    })
  }

  const removeMergeItem = (index: number) => {
    setMergeItems((prev) => prev.filter((_, i) => i !== index))
    clearFeedback()
  }

  const handleExecuteMerge = async () => {
    clearFeedback()
    if (mergeItems.length < 2) {
      setErrorMessage('Selecione pelo menos 2 arquivos PDF para juntar.')
      return
    }

    setIsBusy(true)
    try {
      const result = await mergePdfDocuments(mergeItems.map((item) => item.bytes))
      downloadBytesAsFile(result.bytes, 'agiliza-mesclado.pdf')
      setSuccessMessage(
        `PDF mesclado pronto (${result.pageCount} ${result.pageCount === 1 ? 'página' : 'páginas'}, ${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao juntar os PDFs.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleExecuteSplit = async () => {
    clearFeedback()
    if (!singleItem) {
      setErrorMessage('Envie 1 arquivo PDF antes de extrair páginas.')
      return
    }

    setIsBusy(true)
    try {
      const pages = parsePageRange(splitRange, singleItem.pageCount)
      const result = await extractPdfPages(singleItem.bytes, pages)
      downloadBytesAsFile(result.bytes, 'agiliza-extraido.pdf')
      setSuccessMessage(
        `Extração concluída (${result.pageCount} ${result.pageCount === 1 ? 'página' : 'páginas'}, ${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao extrair páginas do PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleExecuteRotate = async () => {
    clearFeedback()
    if (!singleItem) {
      setErrorMessage('Envie 1 arquivo PDF antes de girar páginas.')
      return
    }

    setIsBusy(true)
    try {
      const pages = rotateRange.trim()
        ? parsePageRange(rotateRange, singleItem.pageCount)
        : undefined
      const result = await rotatePdfPages(singleItem.bytes, rotateAngle, pages)
      downloadBytesAsFile(result.bytes, 'agiliza-girado.pdf')
      setSuccessMessage(
        `Rotação de ${rotateAngle}° aplicada (${result.pageCount} ${result.pageCount === 1 ? 'página' : 'páginas'}, ${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao girar páginas do PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleExecuteRemove = async () => {
    clearFeedback()
    if (!singleItem) {
      setErrorMessage('Envie 1 arquivo PDF antes de remover páginas.')
      return
    }

    setIsBusy(true)
    try {
      const pagesToRemove = parsePageRange(removeRange, singleItem.pageCount)
      const result = await removePdfPages(singleItem.bytes, pagesToRemove)
      downloadBytesAsFile(result.bytes, 'agiliza-reduzido.pdf')
      setSuccessMessage(
        `Páginas removidas com sucesso. O novo arquivo possui ${result.pageCount} ${result.pageCount === 1 ? 'página' : 'páginas'} (${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao remover páginas do PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const currentModeInfo =
    MODE_OPTIONS.find((item) => item.id === mode) ?? MODE_OPTIONS[0]

  return (
    <div className="space-y-6">
      {/* Seletor de sub-operação */}
      <div
        role="group"
        aria-label="Escolha a operação de organização de PDF"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {MODE_OPTIONS.map((option) => {
          const active = option.id === mode
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => handleModeChange(option.id)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
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

      {/* Modo Juntar PDFs */}
      {mode === 'merge' && (
        <div className="space-y-5">
          <FileDropzone
            id="dropzone-organize-merge"
            label="Arraste os arquivos PDF para juntar ou clique para selecionar"
            helperText="Formato .pdf, até 25 MB por arquivo e até 15 arquivos (50 MB no total)."
            allowedExtensions={['.pdf']}
            accept=".pdf,application/pdf"
            multiple
            maxFiles={MAX_MERGE_FILES}
            files={mergeItems.map((item) => item.file)}
            onFilesChange={handleMergeFilesChange}
            hideFileList
          />

          {mergeItems.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Ordem de junção ({mergeItems.length}{' '}
                  {mergeItems.length === 1 ? 'arquivo' : 'arquivos'})
                </span>
                <span>
                  Total:{' '}
                  {mergeItems.reduce((acc, item) => acc + item.pageCount, 0)}{' '}
                  páginas
                </span>
              </div>

              <ul
                className="space-y-2"
                aria-label="Lista ordenada de PDFs para juntar"
              >
                {mergeItems.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-950 text-xs font-bold text-blue-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {item.file.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {item.pageCount}{' '}
                          {item.pageCount === 1 ? 'página' : 'páginas'} •{' '}
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => moveMergeItem(index, -1)}
                        disabled={index === 0 || isBusy}
                        aria-label={`Mover ${item.file.name} para cima`}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:border-blue-500 disabled:opacity-40"
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMergeItem(index, 1)}
                        disabled={index === mergeItems.length - 1 || isBusy}
                        aria-label={`Mover ${item.file.name} para baixo`}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:border-blue-500 disabled:opacity-40"
                      >
                        Descer
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMergeItem(index)}
                        disabled={isBusy}
                        aria-label={`Remover ${item.file.name}`}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:border-red-500/60 hover:text-red-500 disabled:opacity-40"
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleExecuteMerge}
              disabled={isBusy || mergeItems.length < 2}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              <span>
                {isBusy ? 'Processando no navegador...' : 'Juntar e baixar PDF'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modos de arquivo único (Dividir, Girar, Remover) */}
      {mode !== 'merge' && (
        <div className="space-y-5">
          <FileDropzone
            id={`dropzone-organize-${mode}`}
            label="Envie 1 arquivo PDF para processar"
            helperText="Formato .pdf, 1 arquivo por vez, limite seguro de 25 MB."
            allowedExtensions={['.pdf']}
            accept=".pdf,application/pdf"
            multiple={false}
            maxFiles={1}
            files={singleItem ? [singleItem.file] : []}
            onFilesChange={handleSingleFileChange}
            hideFileList
          />

          {singleItem && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon name="file" className="h-4 w-4 shrink-0 text-blue-400" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">
                    {singleItem.file.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {singleItem.pageCount}{' '}
                    {singleItem.pageCount === 1 ? 'página' : 'páginas'} •{' '}
                    {formatFileSize(singleItem.file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSingleItem(null)
                  clearFeedback()
                }}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-red-500/60 hover:text-red-500"
              >
                Trocar arquivo
              </button>
            </div>
          )}

          {mode === 'split' && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="split-page-range"
                  className="block text-xs font-semibold text-white"
                >
                  Páginas ou intervalos para extrair
                </label>
                <input
                  id="split-page-range"
                  type="text"
                  value={splitRange}
                  onChange={(event) => setSplitRange(event.target.value)}
                  placeholder="Ex.: 1-3, 5, 8-10"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleExecuteSplit}
                  disabled={isBusy || !singleItem}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="download" className="h-4 w-4" />
                  <span>
                    {isBusy
                      ? 'Extraindo páginas...'
                      : 'Extrair páginas e baixar PDF'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {mode === 'rotate' && (
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-semibold text-white">
                  Ângulo de rotação (sentido horário)
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ROTATION_ANGLES.map((angle) => {
                    const selected = rotateAngle === angle
                    return (
                      <button
                        key={angle}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setRotateAngle(angle)}
                        className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
                          selected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60'
                        }`}
                      >
                        {angle}°
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="rotate-page-range"
                  className="block text-xs font-semibold text-white"
                >
                  Páginas específicas (opcional, deixe vazio para girar todas)
                </label>
                <input
                  id="rotate-page-range"
                  type="text"
                  value={rotateRange}
                  onChange={(event) => setRotateRange(event.target.value)}
                  placeholder="Ex.: 1, 3-4 (ou vazio para todas)"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleExecuteRotate}
                  disabled={isBusy || !singleItem}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="download" className="h-4 w-4" />
                  <span>
                    {isBusy ? 'Girando páginas...' : 'Girar e baixar PDF'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {mode === 'remove' && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="remove-page-range"
                  className="block text-xs font-semibold text-white"
                >
                  Páginas para remover
                </label>
                <input
                  id="remove-page-range"
                  type="text"
                  value={removeRange}
                  onChange={(event) => setRemoveRange(event.target.value)}
                  placeholder="Ex.: 2, 4-6"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleExecuteRemove}
                  disabled={isBusy || !singleItem}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="download" className="h-4 w-4" />
                  <span>
                    {isBusy
                      ? 'Removendo páginas...'
                      : 'Remover páginas e baixar PDF'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback de execução */}
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

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}
