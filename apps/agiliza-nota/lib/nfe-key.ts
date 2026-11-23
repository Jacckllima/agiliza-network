export const IBGE_UF_MAP: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
}

export interface DecodedNfeAccessKey {
  accessKey: string
  formattedKey: string
  ufCode: string
  ufSigla: string
  yearMonth: string
  emitenteCnpj: string
  modelo: '55' | '65'
  modeloLabel: string
  serie: string
  numero: string
  tpEmis: string
  cNF: string
  dv: number
}

export type NfeAccessKeyValidationResult =
  | { valid: true; data: DecodedNfeAccessKey }
  | { valid: false; error: string }

export function cleanAccessKey(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 44)
}

export function formatAccessKey(raw: string): string {
  const digits = cleanAccessKey(raw)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function computeAccessKeyCheckDigit(first43Digits: string): number {
  if (!/^\d{43}$/.test(first43Digits)) {
    throw new Error('Os 43 primeiros dígitos da chave devem ser numéricos.')
  }

  let sum = 0
  let weight = 2
  for (let i = 42; i >= 0; i -= 1) {
    sum += Number(first43Digits[i]) * weight
    weight = weight === 9 ? 2 : weight + 1
  }

  const remainder = sum % 11
  return remainder === 0 || remainder === 1 ? 0 : 11 - remainder
}

function formatCnpjDigits(cnpj14: string): string {
  return cnpj14.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function validateAndDecodeAccessKey(raw: string): NfeAccessKeyValidationResult {
  const digits = raw.replace(/\D/g, '')

  if (digits.length !== 44) {
    return {
      valid: false,
      error: `A chave de acesso deve conter exatamente 44 dígitos numéricos (informados: ${digits.length}).`,
    }
  }

  const ufCode = digits.slice(0, 2)
  const ufSigla = IBGE_UF_MAP[ufCode]
  if (!ufSigla) {
    return {
      valid: false,
      error: `Código de UF inválido na chave de acesso (${ufCode}).`,
    }
  }

  const yy = digits.slice(2, 4)
  const mm = digits.slice(4, 6)
  const monthNum = Number(mm)
  if (monthNum < 1 || monthNum > 12) {
    return {
      valid: false,
      error: `Mês de emissão inválido na chave de acesso (${mm}).`,
    }
  }

  const modeloRaw = digits.slice(20, 22)
  if (modeloRaw !== '55' && modeloRaw !== '65') {
    return {
      valid: false,
      error: `Modelo fiscal não suportado (${modeloRaw}). Apenas NF-e (55) e NFC-e (65) são aceitos.`,
    }
  }

  const expectedDv = computeAccessKeyCheckDigit(digits.slice(0, 43))
  const informedDv = Number(digits[43])
  if (informedDv !== expectedDv) {
    return {
      valid: false,
      error: 'Dígito verificador da chave de acesso inválido. Confira os 44 dígitos informados.',
    }
  }

  const emitenteCnpj = formatCnpjDigits(digits.slice(6, 20))
  const serie = String(Number(digits.slice(22, 25)))
  const numero = String(Number(digits.slice(25, 34)))
  const tpEmis = digits.slice(34, 35)
  const cNF = digits.slice(35, 43)

  return {
    valid: true,
    data: {
      accessKey: digits,
      formattedKey: formatAccessKey(digits),
      ufCode,
      ufSigla,
      yearMonth: `${mm}/20${yy}`,
      emitenteCnpj,
      modelo: modeloRaw,
      modeloLabel: modeloRaw === '55' ? 'NF-e (Modelo 55)' : 'NFC-e (Modelo 65)',
      serie,
      numero,
      tpEmis,
      cNF,
      dv: informedDv,
    },
  }
}
