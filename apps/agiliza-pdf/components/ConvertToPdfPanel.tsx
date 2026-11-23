'use client'

import { useState, type ChangeEvent } from 'react'
import { Icon, type IconName } from '@agiliza/ui'
import { FileDropzone } from './FileDropzone'
import { formatFileSize, getFileExtension } from '../lib/file-validation'
import {
  convertImagesToPdf,
  convertTextToPdf,
  type EmbeddableImageInput,
  type PageMarginPreset,
  type PageOrientation,
} from '../lib/convert-to-pdf'
import { downloadBytesAsFile } from '../lib/browser-download'

type ConvertToMode = 'images' | 'text'

const MAX_IMAGES = 20
const MAX_IMAGES_TOTAL_BYTES = 30 * 1024 * 1024 // 30 MB

const MODE_OPTIONS = [
  {
    id: 'images' as const,
    label: 'Imagens para PDF (JPG/PNG/WebP)',
    icon: 'image' as IconName,
    description:
      'Monte 1 PDF A4 a partir de imagens JPG, PNG ou WebP, escolhendo ordem, orientação e margens.',
  },
  {
    id: 'text' as const,
    label: 'Texto para PDF (.txt / .md)',
    icon: 'type' as IconName,
    description:
      'Digite, cole ou importe um arquivo .txt ou .md para gerar um PDF A4 com paginação automática.',
  },
] as const

const ORIENTATION_OPTIONS: readonly { value: PageOrientation; label: string }[] = [
  { value: 'auto', label: 'Automática' },
  { value: 'portrait', label: 'Retrato' },
  { value: 'landscape', label: 'Paisagem' },
]

const MARGIN_OPTIONS: readonly { value: PageMarginPreset; label: string }[] = [
  { value: 'none', label: 'Sem margem' },
  { value: 'small', label: 'Pequena' },
  { value: 'standard', label: 'Padrão' },
]

const FONT_SIZE_OPTIONS = [10, 11, 12, 14] as const

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

async function convertWebpFileToPngBytes(file: File): Promise<Uint8Array> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () =>
        reject(new Error(`Não foi possível decodificar a imagem "${file.name}".`))
      element.src = objectUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Contexto 2D indisponível para converter imagem WebP.')
    }
    context.drawImage(img, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!blob) {
      throw new Error(`Falha ao converter "${file.name}" para PNG.`)
    }
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function prepareImageForPdf(file: File): Promise<EmbeddableImageInput> {
  const ext = getFileExtension(file.name)
  if (ext === '.webp') {
    const bytes = await convertWebpFileToPngBytes(file)
    return { name: file.name, format: 'png', bytes }
  }
  const bytes = await readFileBytes(file)
  const format = ext === '.png' ? 'png' : 'jpg'
  return { name: file.name, format, bytes }
}

export function ConvertToPdfPanel() {
  const [mode, setMode] = useState<ConvertToMode>('images')

  // Estado Imagens -> PDF
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [orientation, setOrientation] = useState<PageOrientation>('auto')
  const [imageMargin, setImageMargin] = useState<PageMarginPreset>('small')

  // Estado Texto -> PDF
  const [docTitle, setDocTitle] = useState('')
  const [textBody, setTextBody] = useState('')
  const [fontSize, setFontSize] = useState<number>(11)
  const [textMargin, setTextMargin] = useState<PageMarginPreset>('standard')

  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const clearFeedback = () => {
    setErrorMessage('')
    setStatusMessage('')
  }

  const handleModeChange = (nextMode: ConvertToMode) => {
    setMode(nextMode)
    clearFeedback()
  }

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= imageFiles.length) return
    setImageFiles((prev) => {
      const copy = [...prev]
      const current = copy[index]
      const swapped = copy[target]
      if (!current || !swapped) return prev
      copy[index] = swapped
      copy[target] = current
      return copy
    })
  }

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    clearFeedback()
  }

  const handleGenerateImagesPdf = async () => {
    clearFeedback()
    if (imageFiles.length === 0) {
      setErrorMessage('Selecione pelo menos 1 imagem para converter em PDF.')
      return
    }

    setIsBusy(true)
    try {
      const prepared: EmbeddableImageInput[] = []
      for (const file of imageFiles) {
        prepared.push(await prepareImageForPdf(file))
      }

      const result = await convertImagesToPdf(prepared, {
        orientation,
        margin: imageMargin,
      })

      downloadBytesAsFile(result.bytes, 'agiliza-imagens.pdf')
      setStatusMessage(
        `PDF gerado com ${result.pageCount} ${result.pageCount === 1 ? 'página' : 'páginas'} (${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Erro ao converter as imagens em PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleImportTextFile = async (event: ChangeEvent<HTMLInputElement>) => {
    clearFeedback()
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const ext = getFileExtension(file.name)
    if (ext !== '.txt' && ext !== '.md') {
      setErrorMessage('Formato não suportado. Envie um arquivo .txt ou .md.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('O arquivo de texto excede o limite seguro de 5 MB.')
      return
    }

    try {
      const content =
        typeof file.text === 'function'
          ? await file.text()
          : new TextDecoder('utf-8').decode(await readFileBytes(file))
      setTextBody(content)
      if (!docTitle.trim()) {
        setDocTitle(file.name.replace(/\.(txt|md)$/i, ''))
      }
      setStatusMessage(`Arquivo "${file.name}" carregado no editor local.`)
    } catch {
      setErrorMessage('Não foi possível ler o arquivo de texto selecionado.')
    }
  }

  const handleGenerateTextPdf = async () => {
    clearFeedback()
    if (!textBody.trim()) {
      setErrorMessage('Digite ou importe algum texto antes de gerar o PDF.')
      return
    }

    setIsBusy(true)
    try {
      const result = await convertTextToPdf(textBody, {
        title: docTitle,
        fontSize,
        margin: textMargin,
      })
      downloadBytesAsFile(result.bytes, 'agiliza-texto.pdf')
      setStatusMessage(
        `PDF de texto gerado (${result.pageCount} ${result.pageCount === 1 ? 'página' : 'páginas'}, ${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao gerar PDF a partir do texto.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const currentModeInfo =
    MODE_OPTIONS.find((item) => item.id === mode) ?? MODE_OPTIONS[0]

  return (
    <div className="space-y-6">
      {/* Seletor de sub-modo */}
      <div
        role="group"
        aria-label="Escolha o tipo de entrada para gerar PDF"
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

      {/* Modo Imagens -> PDF */}
      {mode === 'images' && (
        <div className="space-y-5">
          <FileDropzone
            id="dropzone-convert-images-to-pdf"
            label="Arraste imagens JPG, PNG ou WebP aqui ou clique para selecionar"
            helperText="Até 20 imagens (30 MB no total). Cada imagem ocupa uma página A4 sem distorção."
            allowedExtensions={['.jpg', '.jpeg', '.png', '.webp']}
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            maxFiles={MAX_IMAGES}
            maxTotalSizeBytes={MAX_IMAGES_TOTAL_BYTES}
            files={imageFiles}
            onFilesChange={(next) => {
              clearFeedback()
              setImageFiles(next)
            }}
            hideFileList
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-semibold text-white">
                Orientação da página A4
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {ORIENTATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={orientation === opt.value}
                    onClick={() => setOrientation(opt.value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      orientation === opt.value
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-white">
                Margem da página
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {MARGIN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={imageMargin === opt.value}
                    onClick={() => setImageMargin(opt.value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      imageMargin === opt.value
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {imageFiles.length > 0 && (
            <ul
              className="space-y-2"
              aria-label="Lista ordenada de imagens para PDF"
            >
              {imageFiles.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-950 text-xs font-bold text-blue-300">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveImage(index, -1)}
                      disabled={index === 0 || isBusy}
                      aria-label={`Mover ${file.name} para cima`}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:border-blue-500 disabled:opacity-40"
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(index, 1)}
                      disabled={index === imageFiles.length - 1 || isBusy}
                      aria-label={`Mover ${file.name} para baixo`}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:border-blue-500 disabled:opacity-40"
                    >
                      Descer
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      disabled={isBusy}
                      aria-label={`Remover ${file.name}`}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:border-red-500/60 hover:text-red-500 disabled:opacity-40"
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerateImagesPdf}
              disabled={isBusy || imageFiles.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              <span>
                {isBusy ? 'Gerando PDF...' : 'Converter imagens e baixar PDF'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modo Texto -> PDF */}
      {mode === 'text' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            <p className="text-xs text-slate-400">
              Você pode digitar abaixo ou importar 1 arquivo .txt ou .md.
            </p>
            <label
              htmlFor="import-text-file"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-blue-500"
            >
              <Icon name="folder" className="h-3.5 w-3.5" />
              <span>Importar .txt / .md</span>
              <input
                id="import-text-file"
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleImportTextFile}
                className="sr-only"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="text-to-pdf-title"
                className="block text-xs font-semibold text-white"
              >
                Título do documento (opcional)
              </label>
              <input
                id="text-to-pdf-title"
                type="text"
                value={docTitle}
                onChange={(event) => setDocTitle(event.target.value)}
                placeholder="Ex.: Relatório de atividades"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="text-to-pdf-font-size"
                className="block text-xs font-semibold text-white"
              >
                Tamanho da fonte
              </label>
              <select
                id="text-to-pdf-font-size"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500"
              >
                {FONT_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} pt
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-white">
              Margem da página
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {MARGIN_OPTIONS.filter((opt) => opt.value !== 'none').map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={textMargin === opt.value}
                  onClick={() => setTextMargin(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    textMargin === opt.value
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="text-to-pdf-body"
              className="block text-xs font-semibold text-white"
            >
              Conteúdo do texto
            </label>
            <textarea
              id="text-to-pdf-body"
              rows={9}
              value={textBody}
              onChange={(event) => setTextBody(event.target.value)}
              placeholder="Cole ou digite aqui o texto que deseja transformar em PDF A4..."
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-sm text-white placeholder:text-slate-500 leading-relaxed focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerateTextPdf}
              disabled={isBusy || !textBody.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              <span>
                {isBusy ? 'Gerando PDF...' : 'Gerar PDF do texto'}
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
