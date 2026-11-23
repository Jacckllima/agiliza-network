export interface DeclarationItem {
  id: string
  desc: string
  qtd: number
  valor: number
}

export interface ReciboData {
  numero: string
  emissorNome: string
  emissorDoc: string
  pagadorNome: string
  pagadorDoc: string
  valor: number
  referente: string
  cidade: string
  dataDoc: string
}

export interface DeclaracaoData {
  remetenteNome: string
  remetenteDoc: string
  remetenteEnd: string
  destinatarioNome: string
  destinatarioDoc: string
  destinatarioEnd: string
  cidade: string
  dataDoc: string
  itens: DeclarationItem[]
}

export function sanitizePositiveNumber(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function formatBRL(value: number): string {
  return sanitizePositiveNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCpfCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14)

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return digits
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
}

export function calculateDeclarationTotal(itens: DeclarationItem[]): number {
  const sum = itens.reduce((acc, item) => {
    const qtd = sanitizePositiveNumber(item.qtd)
    const unit = sanitizePositiveNumber(item.valor)
    return acc + qtd * unit
  }, 0)

  return sanitizePositiveNumber(sum)
}

export function validateRecibo(data: ReciboData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.emissorNome.trim()) {
    errors.emissorNome = 'Informe o nome de quem recebeu.'
  }
  if (!data.pagadorNome.trim()) {
    errors.pagadorNome = 'Informe o nome de quem pagou.'
  }
  if (!Number.isFinite(data.valor) || data.valor <= 0) {
    errors.valor = 'Informe um valor maior que zero.'
  }
  if (!data.referente.trim()) {
    errors.referente = 'Descreva o motivo ou serviço do recibo.'
  }

  return errors
}

export function validateDeclaracao(data: DeclaracaoData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.remetenteNome.trim()) {
    errors.remetenteNome = 'Informe o nome do remetente.'
  }
  if (!data.remetenteEnd.trim()) {
    errors.remetenteEnd = 'Informe o endereço do remetente.'
  }
  if (!data.destinatarioNome.trim()) {
    errors.destinatarioNome = 'Informe o nome do destinatário.'
  }
  if (!data.destinatarioEnd.trim()) {
    errors.destinatarioEnd = 'Informe o endereço do destinatário.'
  }

  const validItems = data.itens.filter((item) => item.desc.trim().length > 0 && item.qtd > 0)
  if (validItems.length === 0) {
    errors.itens = 'Adicione pelo menos um item com descrição e quantidade maior que zero.'
  }

  return errors
}
