'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Icon, type IconName } from '@agiliza/ui'
import { FileDropzone } from './FileDropzone'
import { formatFileSize } from '../lib/file-validation'
import {
  convertImagesToPdf,
  type EmbeddableImageInput,
} from '../lib/convert-to-pdf'
import { inspectPdfBytes } from '../lib/pdf-operations'
import {
  inspectPdfSecurity,
  protectPdfWithPassword,
  unlockPdfWithPassword,
} from '../lib/pdf-security'
import {
  buildOcrTextFilename,
  MAX_OCR_PAGES,
  runOcrOnPdfBytes,
  type OcrLanguage,
  type OcrProgressUpdate,
} from '../lib/pdf-ocr'
import {
  downloadBytesAsFile,
  downloadTextAsFile,
} from '../lib/browser-download'

type SecurityOcrMode = 'protect' | 'unlock' | 'scanner' | 'ocr'
type ScannerFilterPreset = 'original' | 'document' | 'grayscale'

interface ScannedPageItem {
  id: string
  name: string
  dataUrl: string
  rotation: 0 | 90 | 180 | 270
  filter: ScannerFilterPreset
}

const MODE_OPTIONS = [
  {
    id: 'protect' as const,
    label: 'Proteger com senha',
    icon: 'shield' as IconName,
    description:
      'Criptografe um PDF localmente com AES-256 exigindo senha para abertura e configurando permissões.',
  },
  {
    id: 'unlock' as const,
    label: 'Desbloquear PDF',
    icon: 'check' as IconName,
    description:
      'Informe a senha legítima de um PDF protegido para salvar uma cópia sem senha no seu dispositivo.',
  },
  {
    id: 'scanner' as const,
    label: 'Scanner (Câmera)',
    icon: 'camera' as IconName,
    description:
      'Capture páginas pela câmera do dispositivo ou envie fotos, ajuste rotação e contraste e monte 1 PDF A4.',
  },
  {
    id: 'ocr' as const,
    label: 'OCR Local',
    icon: 'search' as IconName,
    description:
      'Reconheça texto em PDFs escaneados diretamente no navegador (motor carregado sob demanda, até 10 páginas por vez).',
  },
] as const

const OCR_LANGUAGE_OPTIONS: readonly { value: OcrLanguage; label: string }[] = [
  { value: 'por', label: 'Português (Brasil / Portugal)' },
  { value: 'eng', label: 'Inglês' },
  { value: 'por+eng', label: 'Português + Inglês' },
]

const SCANNER_FILTER_OPTIONS: readonly {
  value: ScannerFilterPreset
  label: string
}[] = [
  { value: 'original', label: 'Original' },
  { value: 'document', label: 'Documento (alto contraste)' },
  { value: 'grayscale', label: 'Preto e branco' },
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Falha ao ler a imagem selecionada.'))
      }
    }
    reader.onerror = () => reject(new Error('Falha ao ler a imagem local.'))
    reader.readAsDataURL(file)
  })
}

async function renderScannedPageToJpegBytes(
  item: ScannedPageItem,
): Promise<Uint8Array> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () =>
      reject(new Error(`Não foi possível processar a captura "${item.name}".`))
    element.src = item.dataUrl
  })

  const rawWidth = img.naturalWidth || img.width
  const rawHeight = img.naturalHeight || img.height
  const swapAxes = item.rotation === 90 || item.rotation === 270
  const canvas = document.createElement('canvas')
  canvas.width = swapAxes ? rawHeight : rawWidth
  canvas.height = swapAxes ? rawWidth : rawHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Contexto 2D indisponível para montar o PDF escaneado.')
  }

  context.fillStyle = '#FFFFFF'
  context.fillRect(0, 0, canvas.width, canvas.height)

  if (item.filter === 'document') {
    context.filter = 'contrast(1.35) brightness(1.06) saturate(0.85)'
  } else if (item.filter === 'grayscale') {
    context.filter = 'grayscale(1) contrast(1.45) brightness(1.08)'
  }

  context.save()
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((item.rotation * Math.PI) / 180)
  context.drawImage(img, -rawWidth / 2, -rawHeight / 2, rawWidth, rawHeight)
  context.restore()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.88),
  )
  if (!blob) {
    throw new Error(`Falha ao exportar a captura "${item.name}" em JPEG.`)
  }
  return new Uint8Array(await blob.arrayBuffer())
}

export function SecurityOcrPanel() {
  const [mode, setMode] = useState<SecurityOcrMode>('protect')

  // Estado Proteger PDF
  const [protectFile, setProtectFile] = useState<File | null>(null)
  const [protectBytes, setProtectBytes] = useState<Uint8Array | null>(null)
  const [protectPageCount, setProtectPageCount] = useState<number | null>(null)
  const [userPassword, setUserPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showProtectPassword, setShowProtectPassword] = useState(false)
  const [allowPrinting, setAllowPrinting] = useState(true)
  const [allowCopying, setAllowCopying] = useState(false)
  const [allowModifying, setAllowModifying] = useState(false)

  // Estado Desbloquear PDF
  const [unlockFile, setUnlockFile] = useState<File | null>(null)
  const [unlockBytes, setUnlockBytes] = useState<Uint8Array | null>(null)
  const [unlockIsEncrypted, setUnlockIsEncrypted] = useState<boolean | null>(
    null,
  )
  const [unlockPassword, setUnlockPassword] = useState('')
  const [showUnlockPassword, setShowUnlockPassword] = useState(false)

  // Estado Scanner (Câmera)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [scannedPages, setScannedPages] = useState<ScannedPageItem[]>([])

  // Estado OCR Local
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrBytes, setOcrBytes] = useState<Uint8Array | null>(null)
  const [ocrPageCount, setOcrPageCount] = useState<number | null>(null)
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('por')
  const [ocrPageRange, setOcrPageRange] = useState('')
  const [ocrProgress, setOcrProgress] = useState<OcrProgressUpdate | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const ocrAbortRef = useRef<AbortController | null>(null)

  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const clearFeedback = () => {
    setErrorMessage('')
    setStatusMessage('')
  }

  const stopCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop()
        }
        streamRef.current = null
      }
      ocrAbortRef.current?.abort()
    }
  }, [])

  const handleModeChange = (nextMode: SecurityOcrMode) => {
    if (nextMode !== 'scanner') {
      stopCamera()
    }
    setMode(nextMode)
    clearFeedback()
  }

  // ---- Proteger PDF ----
  const handleProtectFileChange = async (files: File[]) => {
    clearFeedback()
    const file = files[0]
    if (!file) {
      setProtectFile(null)
      setProtectBytes(null)
      setProtectPageCount(null)
      return
    }
    setIsBusy(true)
    try {
      const bytes = await readFileBytes(file)
      const info = await inspectPdfSecurity(bytes)
      if (info.isEncrypted) {
        setProtectFile(null)
        setProtectBytes(null)
        setProtectPageCount(null)
        setErrorMessage(
          'Este PDF já está protegido por senha. Use a opção Desbloquear PDF antes de definir outra senha.',
        )
        return
      }
      setProtectFile(file)
      setProtectBytes(bytes)
      setProtectPageCount(info.pageCount)
    } catch (err) {
      setProtectFile(null)
      setProtectBytes(null)
      setProtectPageCount(null)
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível ler o PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleProtectPdf = async () => {
    clearFeedback()
    if (!protectBytes || !protectFile) {
      setErrorMessage('Envie 1 arquivo PDF antes de aplicar a senha.')
      return
    }
    if (userPassword !== confirmPassword) {
      setErrorMessage('As senhas digitadas não conferem.')
      return
    }
    setIsBusy(true)
    try {
      const result = await protectPdfWithPassword(protectBytes, {
        userPassword,
        allowPrinting,
        allowCopying,
        allowModifying,
      })
      downloadBytesAsFile(result.bytes, 'agiliza-pdf-protegido.pdf')
      setStatusMessage(
        `PDF protegido com criptografia AES-256 (${result.pageCount} ${result.pageCount === 1 ? 'página' : 'páginas'}, ${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao proteger o PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  // ---- Desbloquear PDF ----
  const handleUnlockFileChange = async (files: File[]) => {
    clearFeedback()
    const file = files[0]
    if (!file) {
      setUnlockFile(null)
      setUnlockBytes(null)
      setUnlockIsEncrypted(null)
      return
    }
    setIsBusy(true)
    try {
      const bytes = await readFileBytes(file)
      const info = await inspectPdfSecurity(bytes)
      setUnlockFile(file)
      setUnlockBytes(bytes)
      setUnlockIsEncrypted(info.isEncrypted)
      if (!info.isEncrypted) {
        setStatusMessage(
          'Este PDF já está sem proteção de senha e não precisa ser desbloqueado.',
        )
      }
    } catch (err) {
      setUnlockFile(null)
      setUnlockBytes(null)
      setUnlockIsEncrypted(null)
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível inspecionar o PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleUnlockPdf = async () => {
    clearFeedback()
    if (!unlockBytes || !unlockFile) {
      setErrorMessage('Envie 1 arquivo PDF protegido para desbloquear.')
      return
    }
    setIsBusy(true)
    try {
      const result = await unlockPdfWithPassword(unlockBytes, unlockPassword)
      downloadBytesAsFile(result.bytes, 'agiliza-pdf-desbloqueado.pdf')
      setStatusMessage(
        `Cópia desbloqueada gerada (${result.pageCount} ${result.pageCount === 1 ? 'página' : 'páginas'}, ${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao desbloquear o PDF.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  // ---- Scanner (Câmera) ----
  const handleStartCamera = async () => {
    clearFeedback()
    setCameraError('')
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraError(
        'Este navegador ou dispositivo não disponibiliza acesso à câmera. Use o botão abaixo para enviar fotos do dispositivo.',
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
      })
    } catch (err) {
      const errName =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name: unknown }).name)
          : ''
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError(
          'Permissão de câmera negada pelo navegador. Você pode liberar a permissão ou enviar fotos pelo botão de upload abaixo.',
        )
      } else if (errName === 'NotFoundError') {
        setCameraError(
          'Nenhuma câmera foi encontrada neste dispositivo. Use o envio de fotos abaixo para montar o PDF.',
        )
      } else {
        setCameraError(
          'Não foi possível iniciar a câmera agora. Use o envio de fotos abaixo como alternativa.',
        )
      }
    }
  }

  const handleCaptureCameraFrame = () => {
    clearFeedback()
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setErrorMessage(
        'Aguarde a imagem da câmera carregar antes de capturar a página.',
      )
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setErrorMessage('Contexto 2D indisponível para capturar a imagem.')
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setScannedPages((prev) => [
      ...prev,
      {
        id: `scan-${Date.now()}-${prev.length + 1}`,
        name: `Página capturada ${prev.length + 1}`,
        dataUrl,
        rotation: 0,
        filter: 'document',
      },
    ])
    setStatusMessage('Página capturada pela câmera e adicionada à fila do PDF.')
  }

  const handleUploadScannerPhotos = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    clearFeedback()
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const remainingSlots = Math.max(0, 20 - scannedPages.length)
    if (remainingSlots === 0) {
      setErrorMessage('Limite de 20 páginas escaneadas por PDF atingido.')
      return
    }

    const toAdd = files.slice(0, remainingSlots)
    try {
      const created: ScannedPageItem[] = []
      for (const file of toAdd) {
        const dataUrl = await readFileAsDataUrl(file)
        created.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          dataUrl,
          rotation: 0,
          filter: 'document',
        })
      }
      setScannedPages((prev) => [...prev, ...created])
      setStatusMessage(
        `${created.length} ${created.length === 1 ? 'foto adicionada' : 'fotos adicionadas'} ao scanner.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as fotos selecionadas.',
      )
    }
  }

  const rotateScannedPage = (id: string) => {
    setScannedPages((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              rotation: (((item.rotation + 90) % 360) as 0 | 90 | 180 | 270),
            }
          : item,
      ),
    )
  }

  const updateScannedFilter = (id: string, filter: ScannerFilterPreset) => {
    setScannedPages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, filter } : item)),
    )
  }

  const removeScannedPage = (id: string) => {
    setScannedPages((prev) => prev.filter((item) => item.id !== id))
  }

  const handleBuildScannedPdf = async () => {
    clearFeedback()
    if (scannedPages.length === 0) {
      setErrorMessage(
        'Capture pela câmera ou envie pelo menos 1 foto antes de gerar o PDF.',
      )
      return
    }
    setIsBusy(true)
    try {
      const prepared: EmbeddableImageInput[] = []
      for (const item of scannedPages) {
        const jpegBytes = await renderScannedPageToJpegBytes(item)
        prepared.push({
          name: item.name,
          format: 'jpg',
          bytes: jpegBytes,
        })
      }
      const result = await convertImagesToPdf(prepared, {
        orientation: 'auto',
        margin: 'small',
      })
      downloadBytesAsFile(result.bytes, 'agiliza-pdf-escaneado.pdf')
      setStatusMessage(
        `PDF escaneado gerado com ${result.pageCount} ${result.pageCount === 1 ? 'página' : 'páginas'} (${formatFileSize(result.bytes.byteLength)}). Download iniciado.`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Erro ao montar o PDF a partir das capturas.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  // ---- OCR Local ----
  const handleOcrFileChange = async (files: File[]) => {
    clearFeedback()
    setOcrText('')
    setOcrConfidence(null)
    setOcrProgress(null)
    const file = files[0]
    if (!file) {
      setOcrFile(null)
      setOcrBytes(null)
      setOcrPageCount(null)
      setOcrPageRange('')
      return
    }
    setIsBusy(true)
    try {
      const bytes = await readFileBytes(file)
      const { pageCount } = await inspectPdfBytes(bytes)
      setOcrFile(file)
      setOcrBytes(bytes)
      setOcrPageCount(pageCount)
      const defaultEnd = Math.min(pageCount, MAX_OCR_PAGES)
      setOcrPageRange(defaultEnd === 1 ? '1' : `1-${defaultEnd}`)
    } catch (err) {
      setOcrFile(null)
      setOcrBytes(null)
      setOcrPageCount(null)
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível ler o PDF para OCR.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleRunOcr = async () => {
    clearFeedback()
    if (!ocrBytes || !ocrFile || !ocrPageCount) {
      setErrorMessage('Envie 1 arquivo PDF antes de iniciar o OCR.')
      return
    }

    const controller = new AbortController()
    ocrAbortRef.current = controller
    setIsBusy(true)
    setOcrText('')
    setOcrConfidence(null)
    setOcrProgress(null)

    try {
      const result = await runOcrOnPdfBytes(ocrBytes, {
        language: ocrLanguage,
        pageRangeExpression: ocrPageRange,
        totalPages: ocrPageCount,
        signal: controller.signal,
        onProgress: (update) => setOcrProgress(update),
      })
      setOcrText(result.combinedText)
      setOcrConfidence(result.averageConfidence)
      setStatusMessage(
        `OCR concluído em ${result.processedPages} ${result.processedPages === 1 ? 'página' : 'páginas'} (confiança média estimada: ${result.averageConfidence}%).`,
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao executar OCR local no PDF.',
      )
    } finally {
      ocrAbortRef.current = null
      setOcrProgress(null)
      setIsBusy(false)
    }
  }

  const handleCancelOcr = () => {
    ocrAbortRef.current?.abort()
  }

  const handleCopyOcrText = async () => {
    if (!ocrText) return
    try {
      await navigator.clipboard.writeText(ocrText)
      setStatusMessage('Texto do OCR copiado para a área de transferência.')
    } catch {
      setErrorMessage(
        'Não foi possível copiar automaticamente. Selecione o texto no campo e copie manualmente.',
      )
    }
  }

  const handleDownloadOcrText = () => {
    if (!ocrFile || !ocrText) return
    const filename = buildOcrTextFilename(ocrFile.name)
    downloadTextAsFile(ocrText, filename)
    setStatusMessage(`Arquivo ${filename} gerado localmente. Download iniciado.`)
  }

  const currentModeInfo =
    MODE_OPTIONS.find((item) => item.id === mode) ?? MODE_OPTIONS[0]

  return (
    <div className="space-y-6">
      {/* Seletor de sub-modo */}
      <div
        role="group"
        aria-label="Escolha a ferramenta de segurança, scanner ou OCR"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
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

      {/* 1. Proteger com senha */}
      {mode === 'protect' && (
        <div className="space-y-4">
          <FileDropzone
            id="dropzone-protect-pdf"
            label="Envie 1 arquivo PDF para proteger com senha"
            helperText="Formato .pdf sem senha, até 25 MB. Criptografia AES-256 100% local."
            allowedExtensions={['.pdf']}
            accept=".pdf,application/pdf"
            multiple={false}
            maxFiles={1}
            files={protectFile ? [protectFile] : []}
            onFilesChange={handleProtectFileChange}
            hideFileList
          />

          {protectFile && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-xs">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">
                  {protectFile.name}
                </p>
                <p className="text-slate-400">
                  {protectPageCount ?? 0}{' '}
                  {protectPageCount === 1 ? 'página' : 'páginas'} •{' '}
                  {formatFileSize(protectFile.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProtectFile(null)
                  setProtectBytes(null)
                  setProtectPageCount(null)
                  clearFeedback()
                }}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-red-500 hover:text-red-300"
              >
                Trocar PDF
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="protect-user-password"
                className="block text-xs font-semibold text-white"
              >
                Senha para abrir o PDF
              </label>
              <input
                id="protect-user-password"
                type={showProtectPassword ? 'text' : 'password'}
                value={userPassword}
                onChange={(event) => setUserPassword(event.target.value)}
                placeholder="Mínimo de 4 caracteres"
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="protect-confirm-password"
                className="block text-xs font-semibold text-white"
              >
                Confirmar senha
              </label>
              <input
                id="protect-confirm-password"
                type={showProtectPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-300">
            <label
              htmlFor="protect-show-password"
              className="flex items-center gap-2"
            >
              <input
                id="protect-show-password"
                type="checkbox"
                checked={showProtectPassword}
                onChange={(event) => setShowProtectPassword(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 accent-blue-600"
              />
              <span>Mostrar senha</span>
            </label>

            <label
              htmlFor="protect-allow-printing"
              className="flex items-center gap-2"
            >
              <input
                id="protect-allow-printing"
                type="checkbox"
                checked={allowPrinting}
                onChange={(event) => setAllowPrinting(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 accent-blue-600"
              />
              <span>Permitir impressão</span>
            </label>

            <label
              htmlFor="protect-allow-copying"
              className="flex items-center gap-2"
            >
              <input
                id="protect-allow-copying"
                type="checkbox"
                checked={allowCopying}
                onChange={(event) => setAllowCopying(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 accent-blue-600"
              />
              <span>Permitir cópia de texto</span>
            </label>

            <label
              htmlFor="protect-allow-modifying"
              className="flex items-center gap-2"
            >
              <input
                id="protect-allow-modifying"
                type="checkbox"
                checked={allowModifying}
                onChange={(event) => setAllowModifying(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 accent-blue-600"
              />
              <span>Permitir edição</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleProtectPdf}
              disabled={isBusy || !protectBytes || !userPassword}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="shield" className="h-4 w-4" />
              <span>
                {isBusy ? 'Criptografando...' : 'Proteger e baixar PDF'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Desbloquear PDF */}
      {mode === 'unlock' && (
        <div className="space-y-4">
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-xs text-slate-300"
          >
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
            <p className="leading-relaxed">
              Esta ferramenta remove a senha apenas mediante a senha legítima informada por você. Não realizamos quebra ou recuperação de senhas desconhecidas.
            </p>
          </div>

          <FileDropzone
            id="dropzone-unlock-pdf"
            label="Envie 1 arquivo PDF protegido por senha"
            helperText="Formato .pdf, até 25 MB. O desbloqueio acontece localmente no navegador."
            allowedExtensions={['.pdf']}
            accept=".pdf,application/pdf"
            multiple={false}
            maxFiles={1}
            files={unlockFile ? [unlockFile] : []}
            onFilesChange={handleUnlockFileChange}
            hideFileList
          />

          {unlockFile && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-xs">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">
                  {unlockFile.name}
                </p>
                <p className="text-slate-400">
                  {unlockIsEncrypted
                    ? 'PDF protegido por senha detectado'
                    : 'PDF sem criptografia'} •{' '}
                  {formatFileSize(unlockFile.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUnlockFile(null)
                  setUnlockBytes(null)
                  setUnlockIsEncrypted(null)
                  setUnlockPassword('')
                  clearFeedback()
                }}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-red-500 hover:text-red-300"
              >
                Trocar PDF
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="unlock-pdf-password"
              className="block text-xs font-semibold text-white"
            >
              Senha atual do PDF
            </label>
            <input
              id="unlock-pdf-password"
              type={showUnlockPassword ? 'text' : 'password'}
              value={unlockPassword}
              onChange={(event) => setUnlockPassword(event.target.value)}
              placeholder="Digite a senha para abrir o documento"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500"
            />
            <label
              htmlFor="unlock-show-password"
              className="inline-flex items-center gap-2 text-xs text-slate-300"
            >
              <input
                id="unlock-show-password"
                type="checkbox"
                checked={showUnlockPassword}
                onChange={(event) => setShowUnlockPassword(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 accent-blue-600"
              />
              <span>Mostrar senha</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleUnlockPdf}
              disabled={isBusy || !unlockBytes || !unlockPassword}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="download" className="h-4 w-4" />
              <span>
                {isBusy ? 'Desbloqueando...' : 'Desbloquear e baixar PDF'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Scanner (Câmera) */}
      {mode === 'scanner' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
            {!cameraActive ? (
              <button
                type="button"
                onClick={handleStartCamera}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Icon name="camera" className="h-4 w-4" />
                <span>Abrir câmera</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCaptureCameraFrame}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Icon name="camera" className="h-4 w-4" />
                  <span>Capturar página</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-red-500"
                >
                  <Icon name="x" className="h-4 w-4" />
                  <span>Fechar câmera</span>
                </button>
              </>
            )}

            <label
              htmlFor="scanner-upload-photos"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-blue-500"
            >
              <Icon name="folder" className="h-4 w-4" />
              <span>Enviar foto do dispositivo</span>
              <input
                id="scanner-upload-photos"
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleUploadScannerPhotos}
                className="sr-only"
              />
            </label>
          </div>

          {cameraError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
            >
              <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>{cameraError}</span>
            </div>
          )}

          {cameraActive && (
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                aria-label="Prévia ao vivo da câmera para digitalização"
                className="mx-auto max-h-80 w-full object-contain"
              />
            </div>
          )}

          {scannedPages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  Páginas capturadas ({scannedPages.length} de 20)
                </span>
                <button
                  type="button"
                  onClick={() => setScannedPages([])}
                  className="text-slate-400 hover:text-red-400"
                >
                  Limpar fila
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scannedPages.map((item, idx) => (
                  <article
                    key={item.id}
                    className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900 p-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-semibold text-white">
                        {idx + 1}. {item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeScannedPage(item.id)}
                        aria-label={`Remover ${item.name}`}
                        className="rounded p-1 text-slate-400 hover:text-red-400"
                      >
                        <Icon name="x" className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-white">
                      <img
                        src={item.dataUrl}
                        alt={`Captura ${idx + 1}`}
                        style={{
                          transform: `rotate(${item.rotation}deg)`,
                          filter:
                            item.filter === 'document'
                              ? 'contrast(1.35) brightness(1.06)'
                              : item.filter === 'grayscale'
                                ? 'grayscale(1) contrast(1.45)'
                                : 'none',
                        }}
                        className="max-h-36 max-w-full object-contain"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => rotateScannedPage(item.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-blue-500"
                      >
                        <Icon name="rotate" className="h-3.5 w-3.5" />
                        <span>Girar 90°</span>
                      </button>

                      <select
                        aria-label={`Contraste da página ${idx + 1}`}
                        value={item.filter}
                        onChange={(event) =>
                          updateScannedFilter(
                            item.id,
                            event.target.value as ScannerFilterPreset,
                          )
                        }
                        className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-white"
                      >
                        {SCANNER_FILTER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleBuildScannedPdf}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  <Icon name="download" className="h-4 w-4" />
                  <span>
                    {isBusy ? 'Montando PDF...' : 'Gerar PDF escaneado'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. OCR Local */}
      {mode === 'ocr' && (
        <div className="space-y-4">
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-xs text-slate-300"
          >
            <Icon name="search" className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
            <p className="leading-relaxed">
              O motor de OCR (Tesseract WebAssembly) é carregado sob demanda apenas quando você executa esta função. Por desempenho, cada operação processa até {MAX_OCR_PAGES} páginas por vez.
            </p>
          </div>

          <FileDropzone
            id="dropzone-ocr-pdf"
            label="Envie 1 arquivo PDF escaneado para OCR"
            helperText="Formato .pdf, até 25 MB. O reconhecimento roda localmente no seu navegador."
            allowedExtensions={['.pdf']}
            accept=".pdf,application/pdf"
            multiple={false}
            maxFiles={1}
            files={ocrFile ? [ocrFile] : []}
            onFilesChange={handleOcrFileChange}
            hideFileList
          />

          {ocrFile && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-xs">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">
                  {ocrFile.name}
                </p>
                <p className="text-slate-400">
                  {ocrPageCount ?? 0}{' '}
                  {ocrPageCount === 1 ? 'página' : 'páginas'} •{' '}
                  {formatFileSize(ocrFile.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOcrFile(null)
                  setOcrBytes(null)
                  setOcrPageCount(null)
                  setOcrText('')
                  setOcrConfidence(null)
                  clearFeedback()
                }}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 hover:border-red-500 hover:text-red-300"
              >
                Trocar PDF
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ocr-language-select"
                className="block text-xs font-semibold text-white"
              >
                Idioma principal do documento
              </label>
              <select
                id="ocr-language-select"
                value={ocrLanguage}
                onChange={(event) =>
                  setOcrLanguage(event.target.value as OcrLanguage)
                }
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500"
              >
                {OCR_LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ocr-page-range"
                className="block text-xs font-semibold text-white"
              >
                Páginas para reconhecer (máx. {MAX_OCR_PAGES})
              </label>
              <input
                id="ocr-page-range"
                type="text"
                value={ocrPageRange}
                onChange={(event) => setOcrPageRange(event.target.value)}
                placeholder="Ex.: 1-3, 5"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
          </div>

          {ocrProgress && (
            <div
              role="status"
              className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs"
            >
              <div className="flex items-center justify-between text-slate-200">
                <span>
                  {ocrProgress.stage === 'loading-engine'
                    ? 'Carregando motor OCR e modelo de idioma...'
                    : ocrProgress.stage === 'rendering'
                      ? `Renderizando página ${ocrProgress.pageNumber} (${ocrProgress.currentIndex + 1} de ${ocrProgress.totalPages})...`
                      : `Reconhecendo texto da página ${ocrProgress.pageNumber} (${ocrProgress.currentIndex + 1} de ${ocrProgress.totalPages})...`}
                </span>
                <span className="font-semibold text-blue-400">
                  {ocrProgress.progress}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${ocrProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {isBusy && ocrProgress && (
              <button
                type="button"
                onClick={handleCancelOcr}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
              >
                <Icon name="x" className="h-4 w-4" />
                <span>Cancelar OCR</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRunOcr}
              disabled={isBusy || !ocrBytes}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="search" className="h-4 w-4" />
              <span>
                {isBusy ? 'Reconhecendo texto...' : 'Executar OCR local'}
              </span>
            </button>
          </div>

          {ocrText && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="ocr-result-textarea"
                  className="block text-xs font-semibold text-white"
                >
                  Texto reconhecido por OCR (editável)
                </label>
                {ocrConfidence !== null && (
                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                    Confiança média estimada: {ocrConfidence}%
                  </span>
                )}
              </div>

              <textarea
                id="ocr-result-textarea"
                rows={10}
                value={ocrText}
                onChange={(event) => setOcrText(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3.5 text-xs font-mono text-white leading-relaxed focus:border-blue-500"
              />

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCopyOcrText}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-blue-500"
                >
                  <Icon name="copy" className="h-4 w-4" />
                  <span>Copiar texto</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadOcrText}
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
