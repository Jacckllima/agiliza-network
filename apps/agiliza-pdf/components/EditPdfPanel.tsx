'use client'

import { useState, type ChangeEvent } from 'react'
import { Icon, type IconName } from '@agiliza/ui'
import { FileDropzone } from './FileDropzone'
import { formatFileSize, getFileExtension } from '../lib/file-validation'
import { inspectPdfBytes, parsePageRange } from '../lib/pdf-operations'
import {
  extractTextFromPdfBytes,
  renderPdfPageToImage,
} from '../lib/pdf-to-media'
import {
  addPageNumbersToPdf,
  addWatermarkToPdf,
  applyVisualRedactionToPdf,
  compareExtractedPages,
  cropPdfMargins,
  fillPdfFormFields,
  flattenPdfForm,
  inspectPdfFormFields,
  replacePageWithRasterizedJpeg,
  type PageDiffSummary,
  type PageNumberFormat,
  type PageNumberPosition,
  type PdfFormFieldDescriptor,
} from '../lib/pdf-edit'
import { downloadBytesAsFile } from '../lib/browser-download'

type EditMode =
  | 'numbers'
  | 'watermark'
  | 'crop'
  | 'flatten'
  | 'forms'
  | 'redact'
  | 'compare'

interface LoadedEditPdf {
  file: File
  bytes: Uint8Array
  pageCount: number
}

const EDIT_MODES = [
  { id: 'numbers' as const, label: 'Números de página', icon: 'type' as IconName },
  { id: 'watermark' as const, label: 'Marca d água', icon: 'image' as IconName },
  { id: 'crop' as const, label: 'Recortar', icon: 'scissors' as IconName },
  { id: 'flatten' as const, label: 'Achatar PDF', icon: 'box' as IconName },
  { id: 'forms' as const, label: 'Formulários', icon: 'file' as IconName },
  { id: 'redact' as const, label: 'Ocultar / Tarjar', icon: 'shield' as IconName },
  { id: 'compare' as const, label: 'Comparar PDFs', icon: 'scale' as IconName },
] as const

const POSITION_OPTIONS: readonly { value: PageNumberPosition; label: string }[] = [
  { value: 'bottom-center', label: 'Rodapé centro' },
  { value: 'bottom-right', label: 'Rodapé direita' },
  { value: 'bottom-left', label: 'Rodapé esquerda' },
  { value: 'top-center', label: 'Cabeçalho centro' },
  { value: 'top-right', label: 'Cabeçalho direita' },
  { value: 'top-left', label: 'Cabeçalho esquerda' },
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

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function EditPdfPanel() {
  const [mode, setMode] = useState<EditMode>('numbers')
  const [sourcePdf, setSourcePdf] = useState<LoadedEditPdf | null>(null)

  // Números de página
  const [numPosition, setNumPosition] = useState<PageNumberPosition>('bottom-center')
  const [numFormat, setNumFormat] = useState<PageNumberFormat>('of-total')
  const [startNumber, setStartNumber] = useState(1)

  // Marca d'água
  const [wmType, setWmType] = useState<'text' | 'image'>('text')
  const [wmText, setWmText] = useState('CONFIDENCIAL')
  const [wmImageBytes, setWmImageBytes] = useState<Uint8Array | null>(null)
  const [wmImageName, setWmImageName] = useState('')
  const [wmOpacity, setWmOpacity] = useState(30)
  const [wmRotation, setWmRotation] = useState(-35)

  // Recortar
  const [cropTop, setCropTop] = useState(24)
  const [cropRight, setCropRight] = useState(24)
  const [cropBottom, setCropBottom] = useState(24)
  const [cropLeft, setCropLeft] = useState(24)
  const [cropPages, setCropPages] = useState('')

  // Formulários
  const [formFields, setFormFields] = useState<PdfFormFieldDescriptor[]>([])
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({})
  const [flattenAfterFill, setFlattenAfterFill] = useState(false)

  // Tarjar
  const [redactPage, setRedactPage] = useState(1)
  const [redactPreviewUrl, setRedactPreviewUrl] = useState('')
  const [redactX, setRedactX] = useState(15)
  const [redactY, setRedactY] = useState(20)
  const [redactW, setRedactW] = useState(40)
  const [redactH, setRedactH] = useState(8)
  const [rasterizeRedaction, setRasterizeRedaction] = useState(true)

  // Comparar 2 PDFs
  const [comparePdfA, setComparePdfA] = useState<LoadedEditPdf | null>(null)
  const [comparePdfB, setComparePdfB] = useState<LoadedEditPdf | null>(null)
  const [diffSummary, setDiffSummary] = useState<{
    totalCompared: number
    equalCount: number
    modifiedCount: number
    diffs: PageDiffSummary[]
  } | null>(null)

  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const clearFeedback = () => {
    setErrorMessage('')
    setStatusMessage('')
  }

  const refreshFormAndPreview = async (
    pdf: LoadedEditPdf,
    activeMode: EditMode,
    targetRedactPage = 1,
  ) => {
    if (activeMode === 'forms') {
      try {
        const inspected = await inspectPdfFormFields(pdf.bytes)
        setFormFields(inspected.fields)
        const initial: Record<string, string | boolean> = {}
        for (const field of inspected.fields) {
          initial[field.name] = field.value
        }
        setFormValues(initial)
      } catch {
        setFormFields([])
      }
    }

    if (activeMode === 'redact') {
      try {
        const rendered = await renderPdfPageToImage(pdf.bytes, targetRedactPage, {
          format: 'jpg',
          scale: 1,
          jpgQuality: 0.82,
        })
        setRedactPreviewUrl(rendered.dataUrl)
      } catch {
        setRedactPreviewUrl('')
      }
    }
  }

  const handleModeChange = async (nextMode: EditMode) => {
    setMode(nextMode)
    clearFeedback()
    if (sourcePdf && (nextMode === 'forms' || nextMode === 'redact')) {
      await refreshFormAndPreview(sourcePdf, nextMode, redactPage)
    }
  }

  const handlePrimaryFileChange = async (nextFiles: File[]) => {
    clearFeedback()
    setFormFields([])
    setRedactPreviewUrl('')

    const file = nextFiles[0]
    if (!file) {
      setSourcePdf(null)
      return
    }

    setIsBusy(true)
    try {
      const bytes = await readFileBytes(file)
      const { pageCount } = await inspectPdfBytes(bytes)
      const loaded: LoadedEditPdf = { file, bytes, pageCount }
      setSourcePdf(loaded)
      setRedactPage(1)
      await refreshFormAndPreview(loaded, mode, 1)
    } catch (err) {
      setSourcePdf(null)
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao carregar o PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleWatermarkImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    clearFeedback()
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (getFileExtension(file.name) !== '.png') {
      setErrorMessage('Envie uma imagem PNG válida para a marca d água.')
      return
    }
    const bytes = await readFileBytes(file)
    setWmImageBytes(bytes)
    setWmImageName(file.name)
  }

  const handleApplyPageNumbers = async () => {
    if (!sourcePdf) return
    clearFeedback()
    setIsBusy(true)
    try {
      const result = await addPageNumbersToPdf(sourcePdf.bytes, {
        position: numPosition,
        format: numFormat,
        startNumber,
      })
      downloadBytesAsFile(result.bytes, 'agiliza-numerado.pdf')
      setStatusMessage(
        `Números de página aplicados em ${result.pageCount} páginas. Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao numerar páginas.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleApplyWatermark = async () => {
    if (!sourcePdf) return
    clearFeedback()
    setIsBusy(true)
    try {
      const result = await addWatermarkToPdf(sourcePdf.bytes, {
        text: wmType === 'text' ? wmText : undefined,
        imagePngBytes:
          wmType === 'image' && wmImageBytes ? wmImageBytes : undefined,
        opacity: wmOpacity / 100,
        rotation: wmRotation,
      })
      downloadBytesAsFile(result.bytes, 'agiliza-marca-dagua.pdf')
      setStatusMessage(
        `Marca d água aplicada em ${result.pageCount} páginas. Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao aplicar marca d água.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleApplyCrop = async () => {
    if (!sourcePdf) return
    clearFeedback()
    setIsBusy(true)
    try {
      const pages = cropPages.trim()
        ? parsePageRange(cropPages, sourcePdf.pageCount)
        : undefined
      const result = await cropPdfMargins(
        sourcePdf.bytes,
        {
          top: cropTop,
          right: cropRight,
          bottom: cropBottom,
          left: cropLeft,
        },
        pages,
      )
      downloadBytesAsFile(result.bytes, 'agiliza-recortado.pdf')
      setStatusMessage(
        `Recorte aplicado (${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao recortar PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleApplyFlatten = async () => {
    if (!sourcePdf) return
    clearFeedback()
    setIsBusy(true)
    try {
      const result = await flattenPdfForm(sourcePdf.bytes)
      downloadBytesAsFile(result.bytes, 'agiliza-achatado.pdf')
      setStatusMessage(
        result.flattenedFields > 0
          ? `${result.flattenedFields} campos de formulário achatados com sucesso. Download iniciado.`
          : 'PDF processado e salvo sem campos editáveis pendentes. Download iniciado.',
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao achatar o PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleApplyFormFill = async () => {
    if (!sourcePdf) return
    clearFeedback()
    setIsBusy(true)
    try {
      const result = await fillPdfFormFields(
        sourcePdf.bytes,
        formValues,
        flattenAfterFill,
      )
      downloadBytesAsFile(result.bytes, 'agiliza-formulario.pdf')
      setStatusMessage('Formulário preenchido com sucesso. Download iniciado.')
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao preencher formulário.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleApplyRedaction = async () => {
    if (!sourcePdf) return
    clearFeedback()
    setIsBusy(true)
    try {
      let output = await applyVisualRedactionToPdf(sourcePdf.bytes, [
        {
          pageNumber: redactPage,
          xPercent: redactX,
          yPercent: redactY,
          widthPercent: redactW,
          heightPercent: redactH,
        },
      ])

      if (rasterizeRedaction) {
        const rendered = await renderPdfPageToImage(output.bytes, redactPage, {
          format: 'jpg',
          scale: 1.5,
          jpgQuality: 0.92,
        })
        const jpegBytes = dataUrlToBytes(rendered.dataUrl)
        output = await replacePageWithRasterizedJpeg(
          output.bytes,
          redactPage,
          jpegBytes,
        )
      }

      downloadBytesAsFile(output.bytes, 'agiliza-tarjado.pdf')
      setStatusMessage(
        rasterizeRedaction
          ? `Tarja aplicada e página ${redactPage} rasterizada para remover o texto subjacente. Download iniciado.`
          : `Tarja visual aplicada na página ${redactPage}. Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao aplicar tarja no PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleLoadCompareFile = async (
    slot: 'a' | 'b',
    nextFiles: File[],
  ) => {
    clearFeedback()
    setDiffSummary(null)
    const file = nextFiles[0]
    if (!file) {
      if (slot === 'a') setComparePdfA(null)
      else setComparePdfB(null)
      return
    }
    try {
      const bytes = await readFileBytes(file)
      const { pageCount } = await inspectPdfBytes(bytes)
      const loaded: LoadedEditPdf = { file, bytes, pageCount }
      if (slot === 'a') setComparePdfA(loaded)
      else setComparePdfB(loaded)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao ler o PDF para comparação.',
      )
    }
  }

  const handleRunComparison = async () => {
    clearFeedback()
    if (!comparePdfA || !comparePdfB) {
      setErrorMessage('Envie os dois arquivos PDF (Documento A e Documento B).')
      return
    }
    setIsBusy(true)
    try {
      const [textA, textB] = await Promise.all([
        extractTextFromPdfBytes(comparePdfA.bytes),
        extractTextFromPdfBytes(comparePdfB.bytes),
      ])
      const result = compareExtractedPages(textA.pages, textB.pages)
      setDiffSummary(result)
      setStatusMessage(
        `Comparação concluída: ${result.equalCount} página(s) igual(is) e ${result.modifiedCount} com diferença(s).`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao comparar os PDFs.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub-ferramentas de edição */}
      <div
        role="group"
        aria-label="Ferramentas de edição avançada de PDF"
        className="flex flex-wrap gap-2"
      >
        {EDIT_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={mode === item.id}
            onClick={() => handleModeChange(item.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              mode === item.id
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60 hover:text-white'
            }`}
          >
            <Icon name={item.icon} className="h-3.5 w-3.5 shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Upload único para todos os modos exceto Comparar */}
      {mode !== 'compare' && (
        <>
          <FileDropzone
            id={`dropzone-edit-${mode}`}
            label="Envie 1 arquivo PDF para editar"
            helperText="Formato .pdf, 1 arquivo por vez, limite seguro de 25 MB."
            allowedExtensions={['.pdf']}
            accept=".pdf,application/pdf"
            multiple={false}
            maxFiles={1}
            files={sourcePdf ? [sourcePdf.file] : []}
            onFilesChange={handlePrimaryFileChange}
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
                  setFormFields([])
                  setRedactPreviewUrl('')
                  clearFeedback()
                }}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-red-500/60 hover:text-red-500"
              >
                Trocar arquivo
              </button>
            </div>
          )}
        </>
      )}

      {/* 1. Números de página */}
      {mode === 'numbers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="page-num-position"
                className="block text-xs font-semibold text-white"
              >
                Posição na página
              </label>
              <select
                id="page-num-position"
                value={numPosition}
                onChange={(e) =>
                  setNumPosition(e.target.value as PageNumberPosition)
                }
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {POSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="page-num-format"
                className="block text-xs font-semibold text-white"
              >
                Formato
              </label>
              <select
                id="page-num-format"
                value={numFormat}
                onChange={(e) =>
                  setNumFormat(e.target.value as PageNumberFormat)
                }
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="of-total">1 de N</option>
                <option value="number">Apenas número (1, 2, 3)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="page-num-start"
                className="block text-xs font-semibold text-white"
              >
                Número inicial
              </label>
              <input
                id="page-num-start"
                type="number"
                min={1}
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value)))}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApplyPageNumbers}
              disabled={isBusy || !sourcePdf}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              <span>Inserir números e baixar PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Marca d'água */}
      {mode === 'watermark' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={wmType === 'text'}
              onClick={() => setWmType('text')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                wmType === 'text'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              Texto
            </button>
            <button
              type="button"
              aria-pressed={wmType === 'image'}
              onClick={() => setWmType('image')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                wmType === 'image'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              Imagem PNG
            </button>
          </div>

          {wmType === 'text' ? (
            <div>
              <label
                htmlFor="wm-text-input"
                className="block text-xs font-semibold text-white"
              >
                Texto da marca d água
              </label>
              <input
                id="wm-text-input"
                type="text"
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="wm-image-input"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-blue-500"
              >
                <Icon name="folder" className="h-4 w-4" />
                <span>Selecionar PNG para marca d água</span>
                <input
                  id="wm-image-input"
                  type="file"
                  accept=".png,image/png"
                  onChange={handleWatermarkImageChange}
                  className="sr-only"
                />
              </label>
              {wmImageName && (
                <p className="mt-1.5 text-xs text-slate-400">
                  Imagem selecionada: {wmImageName}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="wm-opacity"
                className="flex justify-between text-xs font-semibold text-white"
              >
                <span>Opacidade</span>
                <span className="text-slate-400">{wmOpacity}%</span>
              </label>
              <input
                id="wm-opacity"
                type="range"
                min={10}
                max={90}
                value={wmOpacity}
                onChange={(e) => setWmOpacity(Number(e.target.value))}
                className="mt-1.5 w-full accent-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="wm-rotation"
                className="flex justify-between text-xs font-semibold text-white"
              >
                <span>Rotação</span>
                <span className="text-slate-400">{wmRotation}°</span>
              </label>
              <input
                id="wm-rotation"
                type="range"
                min={-90}
                max={90}
                value={wmRotation}
                onChange={(e) => setWmRotation(Number(e.target.value))}
                className="mt-1.5 w-full accent-blue-600"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApplyWatermark}
              disabled={isBusy || !sourcePdf}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              <span>Aplicar marca d água e baixar PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Recortar margens */}
      {mode === 'crop' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="crop-top" className="block text-xs font-semibold text-white">
                Topo (pt)
              </label>
              <input
                id="crop-top"
                type="number"
                min={0}
                value={cropTop}
                onChange={(e) => setCropTop(Math.max(0, Number(e.target.value)))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="crop-right" className="block text-xs font-semibold text-white">
                Direita (pt)
              </label>
              <input
                id="crop-right"
                type="number"
                min={0}
                value={cropRight}
                onChange={(e) => setCropRight(Math.max(0, Number(e.target.value)))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="crop-bottom" className="block text-xs font-semibold text-white">
                Inferior (pt)
              </label>
              <input
                id="crop-bottom"
                type="number"
                min={0}
                value={cropBottom}
                onChange={(e) => setCropBottom(Math.max(0, Number(e.target.value)))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label htmlFor="crop-left" className="block text-xs font-semibold text-white">
                Esquerda (pt)
              </label>
              <input
                id="crop-left"
                type="number"
                min={0}
                value={cropLeft}
                onChange={(e) => setCropLeft(Math.max(0, Number(e.target.value)))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="crop-pages" className="block text-xs font-semibold text-white">
              Páginas específicas (opcional, deixe vazio para todas)
            </label>
            <input
              id="crop-pages"
              type="text"
              value={cropPages}
              onChange={(e) => setCropPages(e.target.value)}
              placeholder="Ex.: 1-3, 5"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={isBusy || !sourcePdf}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              <span>Recortar e baixar PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Achatar PDF */}
      {mode === 'flatten' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Achatar o PDF transforma campos de formulário editáveis (AcroForm) em conteúdo fixo na página, impedindo alterações simples em leitores comuns.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApplyFlatten}
              disabled={isBusy || !sourcePdf}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              <span>Achatar e baixar PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Preencher formulários */}
      {mode === 'forms' && (
        <div className="space-y-4">
          {sourcePdf && formFields.length === 0 ? (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
            >
              <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                Nenhum campo de formulário preenchível (AcroForm) foi detectado neste PDF.
              </span>
            </div>
          ) : (
            formFields.length > 0 && (
              <div className="space-y-3">
                {formFields.map((field) => (
                  <div key={field.name}>
                    {field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-xs font-semibold text-white">
                        <input
                          type="checkbox"
                          checked={Boolean(formValues[field.name])}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.name]: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-blue-600"
                        />
                        <span>{field.name}</span>
                      </label>
                    ) : field.type === 'dropdown' ? (
                      <>
                        <label
                          htmlFor={`form-field-${field.name}`}
                          className="block text-xs font-semibold text-white"
                        >
                          {field.name}
                        </label>
                        <select
                          id={`form-field-${field.name}`}
                          value={String(formValues[field.name] ?? '')}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.name]: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                        >
                          <option value="">Selecione...</option>
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <label
                          htmlFor={`form-field-${field.name}`}
                          className="block text-xs font-semibold text-white"
                        >
                          {field.name}
                        </label>
                        <input
                          id={`form-field-${field.name}`}
                          type="text"
                          value={String(formValues[field.name] ?? '')}
                          onChange={(e) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.name]: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                        />
                      </>
                    )}
                  </div>
                ))}

                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={flattenAfterFill}
                    onChange={(e) => setFlattenAfterFill(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span>Achatar campos ao salvar (impedir edição futura)</span>
                </label>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleApplyFormFill}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Icon name="download" className="h-4 w-4" />
                    <span>Salvar formulário e baixar PDF</span>
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* 6. Ocultar / Tarjar */}
      {mode === 'redact' && (
        <div className="space-y-4">
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
          >
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="leading-relaxed">
              <strong>Tarja visual vs. remoção definitiva:</strong> uma tarja apenas desenhada sobre o PDF ainda mantém o texto oculto selecionável. Mantenha marcada a opção de <strong>rasterizar a página tarjada</strong> abaixo para converter a página em imagem e remover definitivamente o texto sob a tarja.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
              {sourcePdf && (
                <div>
                  <label
                    htmlFor="redact-page-select"
                    className="block text-xs font-semibold text-white"
                  >
                    Página para tarjar
                  </label>
                  <select
                    id="redact-page-select"
                    value={redactPage}
                    onChange={async (e) => {
                      const nextPage = Number(e.target.value)
                      setRedactPage(nextPage)
                      await refreshFormAndPreview(sourcePdf, 'redact', nextPage)
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {Array.from(
                      { length: sourcePdf.pageCount },
                      (_, i) => i + 1,
                    ).map((p) => (
                      <option key={p} value={p}>
                        Página {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="redact-x" className="flex justify-between text-xs font-semibold text-white">
                  <span>Esquerda (X)</span>
                  <span className="text-slate-400">{redactX}%</span>
                </label>
                <input
                  id="redact-x"
                  type="range"
                  min={0}
                  max={95}
                  value={redactX}
                  onChange={(e) => setRedactX(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-600"
                />
              </div>

              <div>
                <label htmlFor="redact-y" className="flex justify-between text-xs font-semibold text-white">
                  <span>Topo (Y)</span>
                  <span className="text-slate-400">{redactY}%</span>
                </label>
                <input
                  id="redact-y"
                  type="range"
                  min={0}
                  max={95}
                  value={redactY}
                  onChange={(e) => setRedactY(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-600"
                />
              </div>

              <div>
                <label htmlFor="redact-w" className="flex justify-between text-xs font-semibold text-white">
                  <span>Largura da tarja</span>
                  <span className="text-slate-400">{redactW}%</span>
                </label>
                <input
                  id="redact-w"
                  type="range"
                  min={5}
                  max={90}
                  value={redactW}
                  onChange={(e) => setRedactW(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-600"
                />
              </div>

              <div>
                <label htmlFor="redact-h" className="flex justify-between text-xs font-semibold text-white">
                  <span>Altura da tarja</span>
                  <span className="text-slate-400">{redactH}%</span>
                </label>
                <input
                  id="redact-h"
                  type="range"
                  min={2}
                  max={60}
                  value={redactH}
                  onChange={(e) => setRedactH(Number(e.target.value))}
                  className="mt-1 w-full accent-blue-600"
                />
              </div>

              <label className="flex items-start gap-2 pt-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={rasterizeRedaction}
                  onChange={(e) => setRasterizeRedaction(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span>
                  Rasterizar página tarjada (remove permanentemente o texto subjacente)
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              {redactPreviewUrl ? (
                <div className="relative mx-auto max-w-sm overflow-hidden rounded-lg border border-slate-700 bg-white">
                  <img
                    src={redactPreviewUrl}
                    alt={`Prévia da página ${redactPage} para tarja`}
                    className="block w-full h-auto"
                  />
                  <div
                    style={{
                      left: `${redactX}%`,
                      top: `${redactY}%`,
                      width: `${redactW}%`,
                      height: `${redactH}%`,
                    }}
                    className="pointer-events-none absolute bg-black/90"
                  />
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-400">
                  Envie um PDF acima para visualizar a área da tarja.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApplyRedaction}
              disabled={isBusy || !sourcePdf}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              <span>Aplicar tarja e baixar PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. Comparar 2 PDFs */}
      {mode === 'compare' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FileDropzone
              id="dropzone-compare-a"
              label="Documento A (original)"
              helperText="Formato .pdf, até 25 MB."
              allowedExtensions={['.pdf']}
              accept=".pdf,application/pdf"
              multiple={false}
              maxFiles={1}
              files={comparePdfA ? [comparePdfA.file] : []}
              onFilesChange={(next) => handleLoadCompareFile('a', next)}
            />

            <FileDropzone
              id="dropzone-compare-b"
              label="Documento B (revisado)"
              helperText="Formato .pdf, até 25 MB."
              allowedExtensions={['.pdf']}
              accept=".pdf,application/pdf"
              multiple={false}
              maxFiles={1}
              files={comparePdfB ? [comparePdfB.file] : []}
              onFilesChange={(next) => handleLoadCompareFile('b', next)}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRunComparison}
              disabled={isBusy || !comparePdfA || !comparePdfB}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon name="scale" className="h-4 w-4" />
              <span>{isBusy ? 'Comparando...' : 'Comparar textos dos PDFs'}</span>
            </button>
          </div>

          {diffSummary && (
            <div className="space-y-3">
              {diffSummary.diffs.map((item) => (
                <article
                  key={item.pageNumber}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      Página {item.pageNumber}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        item.status === 'equal'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {item.status === 'equal'
                        ? 'Sem diferenças de texto'
                        : item.status === 'only-a'
                          ? 'Presente apenas no Documento A'
                          : item.status === 'only-b'
                            ? 'Presente apenas no Documento B'
                            : 'Texto alterado'}
                    </span>
                  </div>

                  {item.status !== 'equal' && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs">
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                        <p className="mb-1 font-semibold text-slate-300">
                          Documento A
                        </p>
                        <p className="text-slate-400 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                          {item.textA || '(vazio)'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                        <p className="mb-1 font-semibold text-slate-300">
                          Documento B
                        </p>
                        <p className="text-slate-400 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                          {item.textB || '(vazio)'}
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              ))}
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
