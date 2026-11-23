// Tabela oficial de padrões Code 128 (ISO/IEC 15417), índices 0..106.
// Cada string representa larguras alternadas: barra, espaço, barra, espaço, barra, espaço (Stop tem 7 elementos).
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

const START_C = 105
const STOP = 106

export interface Code128Encoded {
  codes: number[]
  modules: number[] // larguras alternadas: índice par = barra preta, ímpar = espaço branco
  totalModules: number
}

/**
 * Codifica uma sequência numérica de comprimento par (ex.: chave de acesso NF-e de 44 dígitos)
 * no padrão oficial Code 128C (Start C + 2 dígitos por símbolo + Checksum Mod-103 + Stop).
 */
export function encodeCode128C(digitsOnly: string): Code128Encoded {
  const clean = digitsOnly.replace(/\D/g, '')
  if (clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error('Code 128C exige uma sequência numérica não vazia com quantidade par de dígitos.')
  }

  const codes: number[] = [START_C]
  let checksum = START_C

  for (let i = 0; i < clean.length; i += 2) {
    const pairValue = Number(clean.slice(i, i + 2))
    const position = i / 2 + 1
    codes.push(pairValue)
    checksum += pairValue * position
  }

  codes.push(checksum % 103)
  codes.push(STOP)

  const modules: number[] = []
  let totalModules = 0

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code]
    if (!pattern) {
      throw new Error(`Código Code 128 inválido: ${code}`)
    }
    for (let j = 0; j < pattern.length; j += 1) {
      const width = Number(pattern[j])
      modules.push(width)
      totalModules += width
    }
  }

  return { codes, modules, totalModules }
}
