'use client'

import { useState } from 'react'
import { Icon, type IconName } from '@agiliza/ui'
import { FileDropzone } from './FileDropzone'
import { formatFileSize } from '../lib/file-validation'
import { inspectPdfBytes } from '../lib/pdf-operations'
import {
  buildExtractedTextFilename,
  buildPageImageFilename,
  extractTextFromPdfBytes,
  getRenderablePageWindow,
  MAX_RENDER_PAGES,
  renderPdfBatchThumbnails,
  renderPdfPageToImage,
  type ExportImageFormat,
  type RenderedPageImage,
  type RenderScale,
} from '../lib/pdf-to-media'
import {
  downloadDataUrlAsFile,
  downloadTextAsFile,
} from '../lib/browser-download'
import {
  buildMarkdownFilename,
  extractMarkdownFromPdfBytes,
} from '../lib/pdf-extra-converters'

type ConvertFromMode = 'images' | 'text' | 'markdown'

interface LoadedSourcePdf {
  file: File
  bytes: Uint8Array
  pageCount: number
}

const MODE_OPTIONS = [
  {
    id: 'images' as const,
    label: 'PDF para Imagens (PNG/JPG)',
    icon: 'image' as IconName,
    description:
      'Visualize miniaturas das páginas e baixe cada página individualmente em PNG ou JPG na escala escolhida.',
  },
  {
    id: 'text' as const,
    label: 'PDF para Texto (.txt)',
    icon: 'type' as IconName,
    description:
      'Extraia a camada de texto selecionável página por página para copiar ou baixar como arquivo .txt.',
  },
  {
    id: 'markdown' as const,
    label: 'PDF para Markdown (.md)',
    icon: 'code' as IconName,
    description:
      'Exporte o texto do PDF estruturado em Markdown com títulos, listas e separadores de página.',
  },
] as const

const FORMAT_OPTIONS: readonly { value: ExportImageFormat; label: string }[] = [
  { value: 'png', label: 'PNG (sem perdas)' },
  { value: 'jpg', label: 'JPG (mais leve)' },
]

const SCALE_OPTIONS: readonly { value: RenderScale; label: string }[] = [
  { value: 1, label: '1x (Padrão)' },
  { value: 1.5, label: '1,5x (Alta)' },
  { value: 2, label: '2x (Muito alta)' },
]

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

export function ConvertFromPdfPanel() {
  const [mode, setMode] = useState<ConvertFromMode>('images')
  const [sourcePdf, setSourcePdf] = useState<LoadedSourcePdf | null>(null)

  const [format, setFormat] = useState<ExportImageFormat>('png')
  const [scale, setScale] = useState<RenderScale>(1.5)
  const [batchIndex, setBatchIndex] = useState(0)
  const [thumbnails, setThumbnails] = useState<RenderedPageImage[]>([])
  const [downloadingPage, setDownloadingPage] = useState<number | null>(null)

  const [extractedText, setExtractedText] = useState('')
  const [hasExtracted, setHasExtracted] = useState(false)
  const [noSelectableText, setNoSelectableText] = useState(false)
  const [textTruncated, setTextTruncated] = useState(false)

  const [markdownOutput, setMarkdownOutput] = useState('')
  const [hasExtractedMarkdown, setHasExtractedMarkdown] = useState(false)
  const [markdownNoText, setMarkdownNoText] = useState(false)
  const [markdownTruncated, setMarkdownTruncated] = useState(false)
  const [includePageHeaders, setIncludePageHeaders] = useState(true)

  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const clearFeedback = () => {
    setErrorMessage('')
    setStatusMessage('')
  }

  const loadThumbnailsForBatch = async (
    pdf: LoadedSourcePdf,
    targetBatch: number,
  ) => {
    const windowInfo = getRenderablePageWindow(pdf.pageCount, targetBatch)
    if (windowInfo.pages.length === 0) {
      setThumbnails([])
      return
    }
    setIsBusy(true)
    try {
      const rendered = await renderPdfBatchThumbnails(pdf.bytes, windowInfo.pages)
      setThumbnails(rendered)
      setBatchIndex(targetBatch)
    } catch (err) {
      setThumbnails([])
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível renderizar as miniaturas do PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleFileChange = async (nextFiles: File[]) => {
    clearFeedback()
    setThumbnails([])
    setExtractedText('')
    setHasExtracted(false)
    setNoSelectableText(false)
    setTextTruncated(false)
    setMarkdownOutput('')
    setHasExtractedMarkdown(false)
    setMarkdownNoText(false)
    setMarkdownTruncated(false)
    setBatchIndex(0)

    const file = nextFiles[0]
    if (!file) {
      setSourcePdf(null)
      return
    }

    setIsBusy(true)
    try {
      const bytes = await readFileBytes(file)
      const { pageCount } = await inspectPdfBytes(bytes)
      const loaded: LoadedSourcePdf = { file, bytes, pageCount }
      setSourcePdf(loaded)

      if (mode === 'images') {
        await loadThumbnailsForBatch(loaded, 0)
      }
    } catch (err) {
      setSourcePdf(null)
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o arquivo PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleModeChange = async (nextMode: ConvertFromMode) => {
    setMode(nextMode)
    clearFeedback()
    if (nextMode === 'images' && sourcePdf && thumbnails.length === 0) {
      await loadThumbnailsForBatch(sourcePdf, batchIndex)
    }
  }

  const handleDownloadPageImage = async (pageNumber: number) => {
    if (!sourcePdf) return
    clearFeedback()
    setDownloadingPage(pageNumber)
    try {
      const rendered = await renderPdfPageToImage(sourcePdf.bytes, pageNumber, {
        format,
        scale,
      })
      const filename = buildPageImageFilename(
        sourcePdf.file.name,
        pageNumber,
        format,
      )
      downloadDataUrlAsFile(rendered.dataUrl, filename)
      setStatusMessage(
        `Página ${pageNumber} exportada em ${format.toUpperCase()} (${rendered.width}x${rendered.height}px). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : `Erro ao converter a página ${pageNumber}.`,
      )
    } finally {
      setDownloadingPage(null)
    }
  }

  const handleExtractText = async () => {
    if (!sourcePdf) {
      setErrorMessage('Envie 1 arquivo PDF antes de extrair texto.')
      return
    }
    clearFeedback()
    setIsBusy(true)
    try {
      const result = await extractTextFromPdfBytes(sourcePdf.bytes)
      setHasExtracted(true)
      setTextTruncated(result.truncated)
      setNoSelectableText(!result.hasSelectableText)
      setExtractedText(result.combinedText)

      if (result.hasSelectableText) {
        setStatusMessage(
          `Texto extraído de ${result.processedPages} ${result.processedPages === 1 ? 'página' : 'páginas'} localmente no navegador.`,
        )
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao extrair texto do PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleCopyText = async () => {
    if (!extractedText) return
    try {
      await navigator.clipboard.writeText(extractedText)
      setStatusMessage('Texto copiado para a área de transferência.')
    } catch {
      setErrorMessage(
        'Não foi possível copiar automaticamente. Selecione o texto no campo e copie manualmente.',
      )
    }
  }

  const handleDownloadText = () => {
    if (!sourcePdf || !extractedText) return
    const filename = buildExtractedTextFilename(sourcePdf.file.name)
    downloadTextAsFile(extractedText, filename)
    setStatusMessage(`Arquivo ${filename} gerado localmente. Download iniciado.`)
  }

  const handleExtractMarkdown = async () => {
    if (!sourcePdf) {
      setErrorMessage('Envie 1 arquivo PDF antes de converter para Markdown.')
      return
    }
    clearFeedback()
    setIsBusy(true)
    try {
      const result = await extractMarkdownFromPdfBytes(sourcePdf.bytes, {
        includePageHeaders,
      })
      setHasExtractedMarkdown(true)
      setMarkdownTruncated(result.truncated)
      setMarkdownNoText(!result.hasSelectableText)
      setMarkdownOutput(result.markdown)

      if (result.hasSelectableText) {
        setStatusMessage(
          `Markdown estruturado gerado de ${result.processedPages} ${result.processedPages === 1 ? 'página' : 'páginas'} localmente.`,
        )
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Erro ao converter o PDF para Markdown.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleCopyMarkdown = async () => {
    if (!markdownOutput) return
    try {
      await navigator.clipboard.writeText(markdownOutput)
      setStatusMessage('Markdown copiado para a área de transferência.')
    } catch {
      setErrorMessage(
        'Não foi possível copiar automaticamente. Selecione o Markdown no campo e copie manualmente.',
      )
    }
  }

  const handleDownloadMarkdown = () => {
    if (!sourcePdf || !markdownOutput) return
    const filename = buildMarkdownFilename(sourcePdf.file.name)
    downloadTextAsFile(markdownOutput, filename, 'text/markdown;charset=utf-8')
    setStatusMessage(`Arquivo ${filename} gerado localmente. Download iniciado.`)
  }

  const currentModeInfo =
    MODE_OPTIONS.find((item) => item.id === mode) ?? MODE_OPTIONS[0]
  const pageWindow = sourcePdf
    ? getRenderablePageWindow(sourcePdf.pageCount, batchIndex)
    : null

  return (
    <div className="space-y-6">
      {/* Seletor de sub-modo */}
      <div
        role="group"
        aria-label="Escolha o formato de saída do PDF"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
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
        id="dropzone-convert-from-pdf"
        label="Envie 1 arquivo PDF para converter"
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
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Icon name="file" className="h-4 w-4 shrink-0 text-blue-400" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {sourcePdf.file.name}
              </p>
              <p className="text-[11px] text-slate-400">
                {sourcePdf.pageCount}{' '}
                {sourcePdf.pageCount === 1 ? 'página' : 'páginas'} •{' '}
                {formatFileSize(sourcePdf.file.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSourcePdf(null)
              setThumbnails([])
              setExtractedText('')
              setHasExtracted(false)
              setNoSelectableText(false)
              clearFeedback()
            }}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-red-500/60 hover:text-red-500"
          >
            Trocar arquivo
          </button>
        </div>
      )}

      {/* Modo PDF -> Imagens */}
      {mode === 'images' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-semibold text-white">
                Formato da imagem
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={format === option.value}
                    onClick={() => setFormat(option.value)}
                    className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                      format === option.value
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-white">
                Escala / resolução
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {SCALE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={scale === option.value}
                    onClick={() => setScale(option.value)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      scale === option.value
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {pageWindow?.isTruncated && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200"
            >
              <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                Para proteger a memória do navegador, a prévia exibe até as primeiras {MAX_RENDER_PAGES} páginas.
              </span>
            </div>
          )}

          {isBusy && thumbnails.length === 0 && sourcePdf && (
            <p className="text-xs text-slate-400">
              Renderizando miniaturas localmente no navegador...
            </p>
          )}

          {thumbnails.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {thumbnails.map((thumb) => {
                  const isDownloading = downloadingPage === thumb.pageNumber
                  return (
                    <article
                      key={thumb.pageNumber}
                      className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">
                          Página {thumb.pageNumber}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {format.toUpperCase()} • {scale}x
                        </span>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-slate-800 bg-white">
                        <img
                          src={thumb.dataUrl}
                          alt={`Prévia da página ${thumb.pageNumber}`}
                          className="mx-auto max-h-56 w-auto object-contain"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadPageImage(thumb.pageNumber)}
                        disabled={isDownloading}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Icon name="download" className="h-3.5 w-3.5" />
                        <span>
                          {isDownloading
                            ? 'Exportando...'
                            : `Baixar página ${thumb.pageNumber} (${format.toUpperCase()})`}
                        </span>
                      </button>
                    </article>
                  )
                })}
              </div>

              {pageWindow && pageWindow.totalBatches > 1 && sourcePdf && (
                <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs">
                  <button
                    type="button"
                    disabled={batchIndex === 0 || isBusy}
                    onClick={() => loadThumbnailsForBatch(sourcePdf, batchIndex - 1)}
                    className="rounded-md border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 hover:border-blue-500 disabled:opacity-40"
                  >
                    Páginas anteriores
                  </button>
                  <span className="text-slate-400">
                    Bloco {batchIndex + 1} de {pageWindow.totalBatches}
                  </span>
                  <button
                    type="button"
                    disabled={batchIndex >= pageWindow.totalBatches - 1 || isBusy}
                    onClick={() => loadThumbnailsForBatch(sourcePdf, batchIndex + 1)}
                    className="rounded-md border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 hover:border-blue-500 disabled:opacity-40"
                  >
                    Próximas páginas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modo PDF -> Texto */}
      {mode === 'text' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleExtractText}
              disabled={isBusy || !sourcePdf}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="type" className="h-4 w-4" />
              <span>
                {isBusy ? 'Extraindo texto...' : 'Extrair texto do PDF'}
              </span>
            </button>
          </div>

          {hasExtracted && noSelectableText && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
            >
              <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="leading-relaxed">
                Nenhum texto selecionável foi encontrado neste PDF. O arquivo parece ser composto apenas por imagens escaneadas. Use a aba Segurança e OCR para reconhecer texto de páginas escaneadas.
              </p>
            </div>
          )}

          {hasExtracted && !noSelectableText && (
            <div className="space-y-3">
              {textTruncated && (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Aviso: a extração foi limitada às primeiras {MAX_RENDER_PAGES} páginas para manter o navegador responsivo.
                </p>
              )}

              <div>
                <label
                  htmlFor="extracted-pdf-text"
                  className="block text-xs font-semibold text-white"
                >
                  Texto extraído (editável antes de copiar ou baixar)
                </label>
                <textarea
                  id="extracted-pdf-text"
                  rows={10}
                  value={extractedText}
                  onChange={(event) => setExtractedText(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-xs font-mono text-white leading-relaxed focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-blue-500"
                >
                  <Icon name="copy" className="h-4 w-4" />
                  <span>Copiar texto</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadText}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Icon name="download" className="h-4 w-4" />
                  <span>Baixar .txt</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modo PDF -> Markdown */}
      {mode === 'markdown' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            <label
              htmlFor="markdown-include-page-headers"
              className="flex items-center gap-2 text-xs text-slate-300"
            >
              <input
                id="markdown-include-page-headers"
                type="checkbox"
                checked={includePageHeaders}
                onChange={(event) => setIncludePageHeaders(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 accent-blue-600"
              />
              <span>Incluir marcadores de página nos comentários Markdown</span>
            </label>

            <button
              type="button"
              onClick={handleExtractMarkdown}
              disabled={isBusy || !sourcePdf}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="code" className="h-4 w-4" />
              <span>
                {isBusy ? 'Convertendo para Markdown...' : 'Converter PDF para Markdown'}
              </span>
            </button>
          </div>

          {hasExtractedMarkdown && markdownNoText && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
            >
              <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="leading-relaxed">
                Nenhum texto selecionável foi encontrado neste PDF. Se o arquivo for um documento escaneado, utilize a aba Segurança e OCR.
              </p>
            </div>
          )}

          {hasExtractedMarkdown && !markdownNoText && (
            <div className="space-y-3">
              {markdownTruncated && (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Aviso: a conversão foi limitada às primeiras {MAX_RENDER_PAGES} páginas para manter o navegador responsivo.
                </p>
              )}

              <div>
                <label
                  htmlFor="extracted-pdf-markdown"
                  className="block text-xs font-semibold text-white"
                >
                  Markdown gerado (editável antes de copiar ou baixar)
                </label>
                <textarea
                  id="extracted-pdf-markdown"
                  rows={10}
                  value={markdownOutput}
                  onChange={(event) => setMarkdownOutput(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-xs font-mono text-white leading-relaxed focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-blue-500"
                >
                  <Icon name="copy" className="h-4 w-4" />
                  <span>Copiar Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Icon name="download" className="h-4 w-4" />
                  <span>Baixar .md</span>
                </button>
              </div>
            </div>
          )}
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
