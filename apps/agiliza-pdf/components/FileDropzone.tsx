'use client'

import { useState, type ChangeEvent, type DragEvent } from 'react'
import { Icon } from '@agiliza/ui'
import {
  formatFileSize,
  MAX_SINGLE_FILE_BYTES,
  MAX_TOTAL_BATCH_BYTES,
  validateSelectedFiles,
} from '../lib/file-validation'

export interface FileDropzoneProps {
  id: string
  label: string
  helperText: string
  allowedExtensions: readonly string[]
  accept: string
  multiple?: boolean
  maxFiles?: number
  maxFileSizeBytes?: number
  maxTotalSizeBytes?: number
  files: File[]
  onFilesChange: (nextFiles: File[]) => void
}

export function FileDropzone({
  id,
  label,
  helperText,
  allowedExtensions,
  accept,
  multiple = false,
  maxFiles = 1,
  maxFileSizeBytes = MAX_SINGLE_FILE_BYTES,
  maxTotalSizeBytes = MAX_TOTAL_BATCH_BYTES,
  files,
  onFilesChange,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState('')

  const handleIncomingFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return

    const list = Array.from(incoming)
    const { accepted, errors: validationErrors } = validateSelectedFiles(
      list,
      files,
      {
        allowedExtensions,
        maxFiles,
        maxFileSizeBytes,
        maxTotalSizeBytes,
      },
    )

    setErrors(validationErrors)

    if (accepted.length > 0) {
      const nextFiles = maxFiles === 1 ? accepted : [...files, ...accepted]
      onFilesChange(nextFiles)
      setStatusMessage(
        `${accepted.length} ${accepted.length === 1 ? 'arquivo pronto' : 'arquivos prontos'} na fila local.`,
      )
    } else if (validationErrors.length > 0) {
      setStatusMessage('')
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleIncomingFiles(event.target.files)
    event.target.value = ''
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    handleIncomingFiles(event.dataTransfer.files)
  }

  const handleRemoveFile = (indexToRemove: number) => {
    const nextFiles = files.filter((_, index) => index !== indexToRemove)
    onFilesChange(nextFiles)
    setErrors([])
    setStatusMessage(
      nextFiles.length === 0
        ? 'Arquivo removido da fila local.'
        : `Restam ${nextFiles.length} ${nextFiles.length === 1 ? 'arquivo' : 'arquivos'} na fila local.`,
    )
  }

  return (
    <div className="space-y-4">
      <label
        htmlFor={id}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-950/60'
            : 'border-slate-700 bg-slate-950/70 hover:border-blue-500/80'
        }`}
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-950 text-blue-400">
          <Icon name="file" className="h-5 w-5" />
        </div>
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 text-xs text-slate-400">{helperText}</span>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white">
          <Icon name="folder" className="h-3.5 w-3.5" />
          <span>Selecionar do dispositivo</span>
        </span>
        <input
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="sr-only"
        />
      </label>

      {/* Região de feedback acessível */}
      <div aria-live="polite" className="space-y-2">
        {errors.map((error) => (
          <div
            key={error}
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300"
          >
            <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ))}

        {statusMessage && errors.length === 0 && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <Icon name="check" className="h-4 w-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <ul className="space-y-2" aria-label="Arquivos selecionados">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon name="file" className="h-4 w-4 shrink-0 text-blue-400" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">
                    {file.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                aria-label={`Remover ${file.name}`}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-red-500/60 hover:text-red-500"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
                <span>Remover</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
