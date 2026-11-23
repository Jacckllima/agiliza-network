import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(currentDir, '..')
const publicDir = resolve(appDir, 'public')
const destination = resolve(publicDir, 'pdf.worker.min.mjs')

const workerUrl = import.meta.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
const workerSource = fileURLToPath(workerUrl)

mkdirSync(publicDir, { recursive: true })
copyFileSync(workerSource, destination)
console.log(`[agiliza-pdf] pdf.worker.min.mjs copiado para ${destination}`)
