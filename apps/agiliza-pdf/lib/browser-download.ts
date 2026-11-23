export function downloadBytesAsFile(
  bytes: Uint8Array,
  filename: string,
  mimeType = 'application/pdf',
): void {
  const safeCopy = new Uint8Array(bytes.byteLength)
  safeCopy.set(bytes)
  const blob = new Blob([safeCopy], { type: mimeType })
  const url = URL.createObjectURL(blob)
  triggerLinkDownload(url, filename, true)
}

export function downloadDataUrlAsFile(dataUrl: string, filename: string): void {
  triggerLinkDownload(dataUrl, filename, false)
}

export function downloadTextAsFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerLinkDownload(url, filename, true)
}

function triggerLinkDownload(
  href: string,
  filename: string,
  shouldRevoke: boolean,
): void {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  if (shouldRevoke) {
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }
}
