export function downloadBytesAsFile(
  bytes: Uint8Array,
  filename: string,
  mimeType = 'application/pdf',
): void {
  const safeCopy = new Uint8Array(bytes.byteLength)
  safeCopy.set(bytes)
  const blob = new Blob([safeCopy], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
