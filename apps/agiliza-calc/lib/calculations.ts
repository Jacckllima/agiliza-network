export const CALC_PARAMETER_METADATA = {
  inss: {
    label: 'Tabela progressiva INSS (referência 2025)',
    source: 'Portaria Interministerial MPS/MF nº 6/2025',
    effectiveFrom: '01/01/2025',
  },
  irrf: {
    label: 'Tabela progressiva mensal IRRF (referência 2025)',
    source: 'MP nº 1.294/2025 (com comparação automática ao desconto simplificado mensal de R$ 607,20)',
    effectiveFrom: '01/05/2025',
  },
  fgts: {
    label: 'FGTS (8% mensal) e multa rescisória (40% na demissão sem justa causa)',
    source: 'Lei nº 8.036/1990',
    effectiveFrom: 'Vigente',
  },
  pj: {
    label: 'Alíquota PJ e contabilidade',
    source: 'Parâmetros editáveis pelo usuário (não há alíquota única universal para PJ)',
    effectiveFrom: 'Configurável na simulação',
  },
} as const

export const INSS_2025_BRACKETS = [
  { limit: 1518.0, rate: 0.075 },
  { limit: 2793.88, rate: 0.09 },
  { limit: 4190.83, rate: 0.12 },
  { limit: 8157.41, rate: 0.14 },
] as const

export const IRRF_2025_BRACKETS = [
  { limit: 2428.8, rate: 0, deduction: 0 },
  { limit: 2826.65, rate: 0.075, deduction: 182.16 },
  { limit: 3751.05, rate: 0.15, deduction: 394.16 },
  { limit: 4664.68, rate: 0.225, deduction: 675.49 },
  { limit: Infinity, rate: 0.275, deduction: 908.73 },
] as const

export const IRRF_2025_SIMPLIFIED_DISCOUNT = 607.2
export const FGTS_MONTHLY_RATE = 0.08
export const FGTS_DISMISSAL_FINE_RATE = 0.4

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function sanitizeNumber(
  value: number,
  options: { min?: number; max?: number; fallback?: number } = {},
): number {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = min } = options
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function calculateProgressiveInss(grossSalary: number): number {
  const salary = sanitizeNumber(grossSalary, { min: 0 })
  if (salary <= 0) return 0

  let total = 0
  let previousLimit = 0

  for (const bracket of INSS_2025_BRACKETS) {
    if (salary <= previousLimit) break
    const taxableSlice = Math.min(salary, bracket.limit) - previousLimit
    if (taxableSlice > 0) {
      total += taxableSlice * bracket.rate
    }
    previousLimit = bracket.limit
  }

  return roundCurrency(total)
}

export function calculateMonthlyIrrf(
  grossSalary: number,
  inssDeduction: number,
): { irrf: number; taxableBase: number; usedSimplifiedDiscount: boolean } {
  const salary = sanitizeNumber(grossSalary, { min: 0 })
  const inss = sanitizeNumber(inssDeduction, { min: 0, max: salary })

  if (salary <= 0) {
    return { irrf: 0, taxableBase: 0, usedSimplifiedDiscount: false }
  }

  const usedSimplifiedDiscount = IRRF_2025_SIMPLIFIED_DISCOUNT > inss
  const effectiveDeduction = usedSimplifiedDiscount ? IRRF_2025_SIMPLIFIED_DISCOUNT : inss
  const taxableBase = roundCurrency(Math.max(0, salary - effectiveDeduction))

  const bracket =
    IRRF_2025_BRACKETS.find((item) => taxableBase <= item.limit) ??
    IRRF_2025_BRACKETS[IRRF_2025_BRACKETS.length - 1]!

  const irrf = roundCurrency(Math.max(0, taxableBase * bracket.rate - bracket.deduction))

  return { irrf, taxableBase, usedSimplifiedDiscount }
}

export interface CltVsPjInput {
  cltSalary: number
  valeRefeicao: number
  planoSaude: number
  pjSalary: number
  pjTaxRatePercent: number
  pjAccountingCost: number
}

export interface CltVsPjResult {
  clt: {
    grossSalary: number
    inss: number
    irrf: number
    usedSimplifiedIrrfDiscount: boolean
    benefits: number
    fgts: number
    decimoTerceiroMes: number
    feriasMes: number
    netMonthly: number
    totalRealValue: number
  }
  pj: {
    grossRevenue: number
    taxRatePercent: number
    taxAmount: number
    accountingCost: number
    netMonthly: number
  }
  monthlyDifferencePjMinusCltTotal: number
}

export function calculateCltVsPj(input: CltVsPjInput): CltVsPjResult {
  const cltSalary = sanitizeNumber(input.cltSalary, { min: 0 })
  const valeRefeicao = sanitizeNumber(input.valeRefeicao, { min: 0 })
  const planoSaude = sanitizeNumber(input.planoSaude, { min: 0 })
  const pjSalary = sanitizeNumber(input.pjSalary, { min: 0 })
  const pjTaxRatePercent = sanitizeNumber(input.pjTaxRatePercent, { min: 0, max: 100 })
  const pjAccountingCost = sanitizeNumber(input.pjAccountingCost, { min: 0 })

  const inss = calculateProgressiveInss(cltSalary)
  const irrfResult = calculateMonthlyIrrf(cltSalary, inss)
  const benefits = roundCurrency(valeRefeicao + planoSaude)
  const fgts = roundCurrency(cltSalary * FGTS_MONTHLY_RATE)
  const decimoTerceiroMes = roundCurrency(cltSalary / 12)
  const feriasMes = roundCurrency((cltSalary * (4 / 3)) / 12)
  const cltNetMonthly = roundCurrency(cltSalary - inss - irrfResult.irrf + benefits)
  const cltTotalRealValue = roundCurrency(cltNetMonthly + fgts + decimoTerceiroMes + feriasMes)

  const pjTaxAmount = roundCurrency(pjSalary * (pjTaxRatePercent / 100))
  const pjNetMonthly = roundCurrency(pjSalary - pjTaxAmount - pjAccountingCost)

  return {
    clt: {
      grossSalary: roundCurrency(cltSalary),
      inss,
      irrf: irrfResult.irrf,
      usedSimplifiedIrrfDiscount: irrfResult.usedSimplifiedDiscount,
      benefits,
      fgts,
      decimoTerceiroMes,
      feriasMes,
      netMonthly: cltNetMonthly,
      totalRealValue: cltTotalRealValue,
    },
    pj: {
      grossRevenue: roundCurrency(pjSalary),
      taxRatePercent: pjTaxRatePercent,
      taxAmount: pjTaxAmount,
      accountingCost: roundCurrency(pjAccountingCost),
      netMonthly: pjNetMonthly,
    },
    monthlyDifferencePjMinusCltTotal: roundCurrency(pjNetMonthly - cltTotalRealValue),
  }
}

export type RescisaoReason = 'sem_justa_causa' | 'pedido_demissao'

export interface RescisaoInput {
  salarioBase: number
  diasTrabalhadosMes: number
  mesesTrabalhadosAno: number
  motivo: RescisaoReason
  avisoPrevioIndenizado: boolean
  saldoFgts: number
}

export interface RescisaoResult {
  saldoSalario: number
  decimoTerceiro: number
  feriasProporcionaisComTerco: number
  avisoPrevio: number
  multaFgts: number
  totalBrutoEstimado: number
}

export function calculateRescisao(input: RescisaoInput): RescisaoResult {
  const salarioBase = sanitizeNumber(input.salarioBase, { min: 0 })
  const diasTrabalhadosMes = Math.round(
    sanitizeNumber(input.diasTrabalhadosMes, { min: 0, max: 30, fallback: 0 }),
  )
  const mesesTrabalhadosAno = Math.round(
    sanitizeNumber(input.mesesTrabalhadosAno, { min: 0, max: 12, fallback: 0 }),
  )
  const saldoFgts = sanitizeNumber(input.saldoFgts, { min: 0 })

  const saldoSalario = roundCurrency((salarioBase / 30) * diasTrabalhadosMes)
  const decimoTerceiro = roundCurrency((salarioBase / 12) * mesesTrabalhadosAno)
  const feriasProporcionaisComTerco = roundCurrency(
    ((salarioBase / 12) * mesesTrabalhadosAno) * (4 / 3),
  )

  const isSemJustaCausa = input.motivo === 'sem_justa_causa'
  const avisoPrevio = isSemJustaCausa && input.avisoPrevioIndenizado ? roundCurrency(salarioBase) : 0
  const multaFgts = isSemJustaCausa ? roundCurrency(saldoFgts * FGTS_DISMISSAL_FINE_RATE) : 0

  const totalBrutoEstimado = roundCurrency(
    saldoSalario + decimoTerceiro + feriasProporcionaisComTerco + avisoPrevio + multaFgts,
  )

  return {
    saldoSalario,
    decimoTerceiro,
    feriasProporcionaisComTerco,
    avisoPrevio,
    multaFgts,
    totalBrutoEstimado,
  }
}

export interface CompoundInterestInput {
  valorInicial: number
  aporteMensal: number
  taxaAnual: number
  anos: number
}

export interface CompoundInterestResult {
  taxaMensalEquivalentePercent: number
  totalMeses: number
  totalInvestido: number
  totalJuros: number
  saldoAcumulado: number
}

export function calculateCompoundInterest(input: CompoundInterestInput): CompoundInterestResult {
  const valorInicial = sanitizeNumber(input.valorInicial, { min: 0 })
  const aporteMensal = sanitizeNumber(input.aporteMensal, { min: 0 })
  const taxaAnual = sanitizeNumber(input.taxaAnual, { min: 0, max: 1000 })
  const anos = Math.round(sanitizeNumber(input.anos, { min: 0, max: 100, fallback: 0 }))

  const totalMeses = anos * 12
  const taxaMensal = taxaAnual === 0 ? 0 : Math.pow(1 + taxaAnual / 100, 1 / 12) - 1

  let saldoAcumulado = valorInicial
  let totalInvestido = valorInicial

  // Aporte mensal aplicado ao final de cada mês capitalizado
  for (let i = 0; i < totalMeses; i++) {
    saldoAcumulado = saldoAcumulado * (1 + taxaMensal) + aporteMensal
    totalInvestido += aporteMensal
  }

  const roundedSaldo = roundCurrency(saldoAcumulado)
  const roundedInvestido = roundCurrency(totalInvestido)
  const roundedJuros = roundCurrency(Math.max(0, roundedSaldo - roundedInvestido))

  return {
    taxaMensalEquivalentePercent: Number((taxaMensal * 100).toFixed(4)),
    totalMeses,
    totalInvestido: roundedInvestido,
    totalJuros: roundedJuros,
    saldoAcumulado: roundedSaldo,
  }
}
