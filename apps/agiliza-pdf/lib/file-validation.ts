export const MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
export const MAX_TOTAL_BATCH_BYTES = 50 * 1024 * 1024 // 50 MB
export const MAX_MERGE_FILES = 15

export interface FileLike {
  name: string
  size: number
  type?: string
}

export interface FileValidationOptions {
  allowedExtensions: readonly string[]
  maxFileSizeBytes?: number
  maxTotalSizeBytes?: number
  maxFiles?: number
}

export interface FileValidationResult<T extends FileLike = FileLike> {
  accepted: T[]
  errors: string[]
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1).replace('.', ',')} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2).replace('.', ',')} MB`
}

export function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase()
  const dotIndex = trimmed.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) return ''
  return trimmed.slice(dotIndex)
}

export function validateSelectedFiles<T extends FileLike>(
  incomingFiles: readonly T[],
  existingFiles: readonly T[],
  options: FileValidationOptions,
): FileValidationResult<T> {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? MAX_SINGLE_FILE_BYTES
  const maxTotalSizeBytes = options.maxTotalSizeBytes ?? MAX_TOTAL_BATCH_BYTES
  const maxFiles = options.maxFiles ?? 1
  const normalizedAllowed = options.allowedExtensions.map((ext) =>
    ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`,
  )

  const accepted: T[] = []
  const errors: string[] = []

  if (incomingFiles.length === 0) {
    return { accepted, errors }
  }

  let currentCount = maxFiles === 1 ? 0 : existingFiles.length
  let currentTotalBytes =
    maxFiles === 1
      ? 0
      : existingFiles.reduce((acc, file) => acc + Math.max(0, file.size), 0)

  if (maxFiles === 1 && incomingFiles.length > 1) {
    errors.push(
      'Esta operação aceita apenas 1 arquivo por vez no modo gratuito. Apenas o primeiro arquivo válido será considerado.',
    )
  }

  const candidates = maxFiles === 1 ? incomingFiles.slice(0, 1) : incomingFiles

  for (const file of candidates) {
    if (currentCount >= maxFiles) {
      errors.push(
        `Limite de ${maxFiles} ${maxFiles === 1 ? 'arquivo' : 'arquivos'} atingido. Remova um item para adicionar outro.`,
      )
      break
    }

    const ext = getFileExtension(file.name)
    if (!ext || !normalizedAllowed.includes(ext)) {
      errors.push(
        `Arquivo "${file.name}" rejeitado: formato não suportado. Envie ${normalizedAllowed.join(', ')}.`,
      )
      continue
    }

    if (file.size <= 0) {
      errors.push(`Arquivo "${file.name}" está vazio e não pode ser processado.`)
      continue
    }

    if (file.size > maxFileSizeBytes) {
      errors.push(
        `Arquivo "${file.name}" excede o limite seguro de ${formatFileSize(maxFileSizeBytes)} por arquivo.`,
      )
      continue
    }

    if (currentTotalBytes + file.size > maxTotalSizeBytes) {
      errors.push(
        `Arquivo "${file.name}" ultrapassa o limite total de ${formatFileSize(maxTotalSizeBytes)} nesta operação.`,
      )
      continue
    }

    accepted.push(file)
    currentCount += 1
    currentTotalBytes += file.size
  }

  return { accepted, errors }
}
