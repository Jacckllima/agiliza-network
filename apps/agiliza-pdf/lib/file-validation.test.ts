import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatFileSize,
  getFileExtension,
  MAX_SINGLE_FILE_BYTES,
  validateSelectedFiles,
} from './file-validation.ts'

describe('file-validation', () => {
  it('formats file sizes in pt-BR units', () => {
    assert.equal(formatFileSize(0), '0 B')
    assert.equal(formatFileSize(512), '512 B')
    assert.equal(formatFileSize(1536), '1,5 KB')
    assert.equal(formatFileSize(2 * 1024 * 1024), '2,00 MB')
  })

  it('extracts lowercase extensions safely', () => {
    assert.equal(getFileExtension('contrato.PDF'), '.pdf')
    assert.equal(getFileExtension('foto.minha.png'), '.png')
    assert.equal(getFileExtension('sem-extensao'), '')
    assert.equal(getFileExtension('.oculto'), '')
  })

  it('accepts valid PDF within limits', () => {
    const result = validateSelectedFiles(
      [{ name: 'documento.pdf', size: 1024 * 500 }],
      [],
      { allowedExtensions: ['.pdf'], maxFiles: 1 },
    )

    assert.equal(result.accepted.length, 1)
    assert.equal(result.errors.length, 0)
  })

  it('rejects unsupported extensions and empty files', () => {
    const result = validateSelectedFiles(
      [
        { name: 'planilha.xlsx', size: 1000 },
        { name: 'vazio.pdf', size: 0 },
      ],
      [],
      { allowedExtensions: ['.pdf'], maxFiles: 5 },
    )

    assert.equal(result.accepted.length, 0)
    assert.equal(result.errors.length, 2)
    assert.match(result.errors[0] ?? '', /formato não suportado/i)
    assert.match(result.errors[1] ?? '', /vazio/i)
  })

  it('rejects files larger than the safe single-file limit', () => {
    const result = validateSelectedFiles(
      [{ name: 'pesado.pdf', size: MAX_SINGLE_FILE_BYTES + 1 }],
      [],
      { allowedExtensions: ['.pdf'], maxFiles: 1 },
    )

    assert.equal(result.accepted.length, 0)
    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0] ?? '', /limite seguro/i)
  })

  it('enforces single-file mode and reports when multiple files are sent', () => {
    const result = validateSelectedFiles(
      [
        { name: 'um.pdf', size: 2048 },
        { name: 'dois.pdf', size: 2048 },
      ],
      [],
      { allowedExtensions: ['.pdf'], maxFiles: 1 },
    )

    assert.equal(result.accepted.length, 1)
    assert.equal(result.accepted[0]?.name, 'um.pdf')
    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0] ?? '', /apenas 1 arquivo por vez/i)
  })

  it('enforces max file count and total size in multi-file mode', () => {
    const existing = [
      { name: 'a.pdf', size: 20 * 1024 * 1024 },
      { name: 'b.pdf', size: 20 * 1024 * 1024 },
    ]
    const result = validateSelectedFiles(
      [{ name: 'c.pdf', size: 15 * 1024 * 1024 }],
      existing,
      {
        allowedExtensions: ['.pdf'],
        maxFiles: 5,
        maxTotalSizeBytes: 50 * 1024 * 1024,
      },
    )

    assert.equal(result.accepted.length, 0)
    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0] ?? '', /limite total/i)
  })
})
