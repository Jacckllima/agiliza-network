'use client'

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { Icon, type IconName } from '@agiliza/ui'
import { FileDropzone } from './FileDropzone'
import { formatFileSize, getFileExtension } from '../lib/file-validation'
import { inspectPdfBytes } from '../lib/pdf-operations'
import { renderPdfPageToImage } from '../lib/pdf-to-media'
import { applyVisualSignatureToPdf } from '../lib/pdf-sign'
import { downloadBytesAsFile } from '../lib/browser-download'

type SignatureMode = 'draw' | 'type' | 'upload'
type InkColor = '#0F172A' | '#1E3A8A'

interface LoadedSignPdf {
  file: File
  bytes: Uint8Array
  pageCount: number
}

const SIGNATURE_MODES = [
  { id: 'draw' as const, label: 'Desenhar', icon: 'penTool' as IconName },
  { id: 'type' as const, label: 'Digitar nome', icon: 'type' as IconName },
  { id: 'upload' as const, label: 'Enviar PNG', icon: 'image' as IconName },
] as const

const INK_COLORS: readonly { value: InkColor; label: string }[] = [
  { value: '#0F172A', label: 'Preto' },
  { value: '#1E3A8A', label: 'Azul escuro' },
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

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const base64Part = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64Part)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function renderTypedSignatureDataUrl(text: string, color: InkColor): string {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 180
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'italic 54px Georgia, "Times New Roman", serif'
  ctx.fillText(text.trim(), canvas.width / 2, canvas.height / 2, canvas.width - 40)
  return canvas.toDataURL('image/png')
}

export function SignPdfPanel() {
  const [sourcePdf, setSourcePdf] = useState<LoadedSignPdf | null>(null)
  const [selectedPage, setSelectedPage] = useState(1)
  const [pagePreviewUrl, setPagePreviewUrl] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  const [signatureMode, setSignatureMode] = useState<SignatureMode>('draw')
  const [inkColor, setInkColor] = useState<InkColor>('#0F172A')

  // Estado modo Desenhar
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [drawnPreviewUrl, setDrawnPreviewUrl] = useState('')

  // Estado modo Digitar
  const [typedName, setTypedName] = useState('')
  const [typedPreviewUrl, setTypedPreviewUrl] = useState('')

  // Estado modo Upload PNG
  const [uploadedPngBytes, setUploadedPngBytes] = useState<Uint8Array | null>(null)
  const [uploadedPngName, setUploadedPngName] = useState('')
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState('')

  // Posicionamento (% top-down)
  const [xPercent, setXPercent] = useState(50)
  const [yPercent, setYPercent] = useState(82)
  const [widthPercent, setWidthPercent] = useState(28)

  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const clearFeedback = () => {
    setErrorMessage('')
    setStatusMessage('')
  }

  // Atualiza prévia da assinatura digitada
  useEffect(() => {
    if (signatureMode !== 'type') return
    if (!typedName.trim()) {
      setTypedPreviewUrl('')
      return
    }
    try {
      setTypedPreviewUrl(renderTypedSignatureDataUrl(typedName, inkColor))
    } catch {
      setTypedPreviewUrl('')
    }
  }, [signatureMode, typedName, inkColor])

  const loadPagePreview = async (pdf: LoadedSignPdf, pageNumber: number) => {
    setLoadingPreview(true)
    try {
      const rendered = await renderPdfPageToImage(pdf.bytes, pageNumber, {
        format: 'jpg',
        scale: 1,
        jpgQuality: 0.85,
      })
      setPagePreviewUrl(rendered.dataUrl)
    } catch (err) {
      setPagePreviewUrl('')
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível renderizar a prévia da página.',
      )
    } finally {
      setLoadingPreview(false)
    }
  }

  const handlePdfChange = async (nextFiles: File[]) => {
    clearFeedback()
    setPagePreviewUrl('')
    const file = nextFiles[0]
    if (!file) {
      setSourcePdf(null)
      return
    }

    setIsBusy(true)
    try {
      const bytes = await readFileBytes(file)
      const { pageCount } = await inspectPdfBytes(bytes)
      const loaded: LoadedSignPdf = { file, bytes, pageCount }
      setSourcePdf(loaded)
      setSelectedPage(1)
      await loadPagePreview(loaded, 1)
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

  const handlePageSelectChange = async (nextPage: number) => {
    if (!sourcePdf) return
    const clamped = Math.min(Math.max(1, nextPage), sourcePdf.pageCount)
    setSelectedPage(clamped)
    clearFeedback()
    await loadPagePreview(sourcePdf, clamped)
  }

  // Handlers do canvas de desenho
  const getCanvasPoint = (
    event: PointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const canvas = drawCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / (rect.width || 1)
    const scaleY = canvas.height / (rect.height || 1)
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    isDrawingRef.current = true
    const point = getCanvasPoint(event)
    ctx.strokeStyle = inkColor
    ctx.lineWidth = 3.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
    setHasDrawing(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const point = getCanvasPoint(event)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const finishStroke = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const canvas = drawCanvasRef.current
    if (canvas) {
      setDrawnPreviewUrl(canvas.toDataURL('image/png'))
    }
  }

  const clearDrawing = () => {
    const canvas = drawCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setHasDrawing(false)
    setDrawnPreviewUrl('')
  }

  const handleUploadSignaturePng = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    clearFeedback()
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (getFileExtension(file.name) !== '.png') {
      setErrorMessage(
        'Envie uma imagem em formato .png (de preferência com fundo transparente).',
      )
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('A imagem de assinatura excede o limite de 5 MB.')
      return
    }

    try {
      const bytes = await readFileBytes(file)
      setUploadedPngBytes(bytes)
      setUploadedPngName(file.name)
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
      setUploadedPreviewUrl(URL.createObjectURL(blob))
    } catch {
      setErrorMessage('Não foi possível ler a imagem PNG selecionada.')
    }
  }

  const handlePreviewClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const nextX = Math.round(((event.clientX - rect.left) / rect.width) * 100)
    const nextY = Math.round(((event.clientY - rect.top) / rect.height) * 100)
    setXPercent(Math.min(100, Math.max(0, nextX)))
    setYPercent(Math.min(100, Math.max(0, nextY)))
  }

  const activeSignaturePreview =
    signatureMode === 'draw'
      ? drawnPreviewUrl
      : signatureMode === 'type'
        ? typedPreviewUrl
        : uploadedPreviewUrl

  const handleApplySignature = async () => {
    clearFeedback()
    if (!sourcePdf) {
      setErrorMessage('Envie 1 arquivo PDF antes de aplicar a assinatura.')
      return
    }

    setIsBusy(true)
    try {
      let pngBytes: Uint8Array | null = null

      if (signatureMode === 'draw') {
        if (!hasDrawing || !drawnPreviewUrl) {
          throw new Error('Desenhe sua assinatura no quadro antes de aplicar.')
        }
        pngBytes = await dataUrlToBytes(drawnPreviewUrl)
      } else if (signatureMode === 'type') {
        if (!typedName.trim()) {
          throw new Error('Digite o nome da assinatura antes de aplicar.')
        }
        const url =
          typedPreviewUrl || renderTypedSignatureDataUrl(typedName, inkColor)
        if (!url) {
          throw new Error('Não foi possível renderizar a assinatura digitada.')
        }
        pngBytes = await dataUrlToBytes(url)
      } else {
        if (!uploadedPngBytes) {
          throw new Error('Envie uma imagem PNG de assinatura antes de aplicar.')
        }
        pngBytes = uploadedPngBytes
      }

      const result = await applyVisualSignatureToPdf(sourcePdf.bytes, pngBytes, {
        pageNumber: selectedPage,
        xPercent,
        yPercent,
        widthPercent,
      })

      downloadBytesAsFile(result.bytes, 'agiliza-assinado.pdf')
      setStatusMessage(
        `Assinatura visual aplicada na página ${selectedPage} (${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Erro ao aplicar a assinatura visual no PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Aviso legal obrigatório */}
      <div
        role="note"
        className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
      >
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="leading-relaxed">
          <strong>Assinatura visual gráfica:</strong> esta ferramenta aplica uma imagem visual da sua assinatura localmente no navegador. Ela não substitui assinatura digital criptográfica com certificado ICP-Brasil.
        </p>
      </div>

      {/* Passo 1: Upload do PDF */}
      <FileDropzone
        id="dropzone-sign-pdf"
        label="Envie 1 arquivo PDF para assinar visualmente"
        helperText="Formato .pdf, 1 arquivo por vez, limite seguro de 25 MB."
        allowedExtensions={['.pdf']}
        accept=".pdf,application/pdf"
        multiple={false}
        maxFiles={1}
        files={sourcePdf ? [sourcePdf.file] : []}
        onFilesChange={handlePdfChange}
        hideFileList
      />

      {sourcePdf && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
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

          <div className="flex items-center gap-2">
            <label
              htmlFor="sign-page-select"
              className="text-xs font-semibold text-slate-300"
            >
              Página:
            </label>
            <select
              id="sign-page-select"
              value={selectedPage}
              onChange={(event) =>
                handlePageSelectChange(Number(event.target.value))
              }
              className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white focus:border-blue-500"
            >
              {Array.from({ length: sourcePdf.pageCount }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <option key={pageNumber} value={pageNumber}>
                    Página {pageNumber}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      )}

      {/* Passo 2: Criar assinatura */}
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Modo de criação da assinatura"
            className="flex flex-wrap gap-2"
          >
            {SIGNATURE_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={signatureMode === item.id}
                onClick={() => {
                  setSignatureMode(item.id)
                  clearFeedback()
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  signatureMode === item.id
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-blue-500/60'
                }`}
              >
                <Icon name={item.icon} className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {signatureMode !== 'upload' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Cor da tinta:</span>
              {INK_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  aria-pressed={inkColor === color.value}
                  onClick={() => setInkColor(color.value)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                    inkColor === color.value
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-700 text-slate-300 hover:border-blue-500'
                  }`}
                >
                  {color.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {signatureMode === 'draw' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              Desenhe com mouse, trackpad ou dedo no quadro abaixo:
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
              <canvas
                ref={drawCanvasRef}
                width={640}
                height={180}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishStroke}
                onPointerLeave={finishStroke}
                className="h-36 w-full touch-none cursor-crosshair"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearDrawing}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-red-500/60 hover:text-red-500"
              >
                Limpar desenho
              </button>
            </div>
          </div>
        )}

        {signatureMode === 'type' && (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="sign-typed-name"
                className="block text-xs font-semibold text-white"
              >
                Nome para assinatura visual
              </label>
              <input
                id="sign-typed-name"
                type="text"
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                placeholder="Ex.: Maria da Silva"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
            {typedPreviewUrl && (
              <div className="rounded-lg border border-slate-700 bg-white p-3 text-center">
                <img
                  src={typedPreviewUrl}
                  alt="Prévia da assinatura digitada"
                  className="mx-auto max-h-20 w-auto object-contain"
                />
              </div>
            )}
          </div>
        )}

        {signatureMode === 'upload' && (
          <div className="space-y-3">
            <label
              htmlFor="sign-upload-png"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-blue-500"
            >
              <Icon name="folder" className="h-4 w-4" />
              <span>Selecionar imagem PNG da assinatura</span>
              <input
                id="sign-upload-png"
                type="file"
                accept=".png,image/png"
                onChange={handleUploadSignaturePng}
                className="sr-only"
              />
            </label>
            {uploadedPngName && (
              <p className="text-xs text-slate-400">
                Imagem carregada: <strong>{uploadedPngName}</strong>
              </p>
            )}
            {uploadedPreviewUrl && (
              <div className="rounded-lg border border-slate-700 bg-white p-3 text-center">
                <img
                  src={uploadedPreviewUrl}
                  alt="Prévia da imagem PNG de assinatura"
                  className="mx-auto max-h-20 w-auto object-contain"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Passo 3: Posicionamento e prévia da página */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-bold text-white">
            Posição e tamanho (acessível por teclado ou clique na prévia)
          </h3>

          <div>
            <label
              htmlFor="sign-pos-x"
              className="flex justify-between text-xs font-semibold text-white"
            >
              <span>Posição horizontal (X)</span>
              <span className="text-slate-400">{xPercent}%</span>
            </label>
            <input
              id="sign-pos-x"
              type="range"
              min={0}
              max={100}
              value={xPercent}
              onChange={(event) => setXPercent(Number(event.target.value))}
              className="mt-1.5 w-full accent-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="sign-pos-y"
              className="flex justify-between text-xs font-semibold text-white"
            >
              <span>Posição vertical (Y a partir do topo)</span>
              <span className="text-slate-400">{yPercent}%</span>
            </label>
            <input
              id="sign-pos-y"
              type="range"
              min={0}
              max={100}
              value={yPercent}
              onChange={(event) => setYPercent(Number(event.target.value))}
              className="mt-1.5 w-full accent-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="sign-width"
              className="flex justify-between text-xs font-semibold text-white"
            >
              <span>Largura da assinatura</span>
              <span className="text-slate-400">{widthPercent}% da página</span>
            </label>
            <input
              id="sign-width"
              type="range"
              min={10}
              max={60}
              value={widthPercent}
              onChange={(event) => setWidthPercent(Number(event.target.value))}
              className="mt-1.5 w-full accent-blue-600"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white">
              Prévia da página {selectedPage}
            </span>
            <span className="text-slate-400">
              Clique na página para posicionar
            </span>
          </div>

          {loadingPreview ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-400">
              Renderizando prévia da página...
            </div>
          ) : pagePreviewUrl ? (
            <div
              onClick={handlePreviewClick}
              className="relative mx-auto w-full max-w-sm cursor-crosshair overflow-hidden rounded-lg border border-slate-700 bg-white"
            >
              <img
                src={pagePreviewUrl}
                alt={`Prévia da página ${selectedPage} do PDF`}
                className="block w-full h-auto select-none"
              />
              {activeSignaturePreview && (
                <img
                  src={activeSignaturePreview}
                  alt="Posição estimada da assinatura"
                  style={{
                    left: `${xPercent}%`,
                    top: `${yPercent}%`,
                    width: `${widthPercent}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="pointer-events-none absolute border border-dashed border-blue-600 bg-blue-500/5"
                />
              )}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/60 px-4 text-center text-xs text-slate-400">
              Envie um arquivo PDF acima para visualizar a página e posicionar sua assinatura.
            </div>
          )}
        </div>
      </div>

      {/* Botão principal */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleApplySignature}
          disabled={isBusy || !sourcePdf}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="download" className="h-4 w-4" />
          <span>
            {isBusy ? 'Aplicando assinatura...' : 'Aplicar assinatura e baixar PDF'}
          </span>
        </button>
      </div>

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
