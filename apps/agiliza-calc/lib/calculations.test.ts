import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  calculateCltVsPj,
  calculateCompoundInterest,
  calculateMonthlyIrrf,
  calculateProgressiveInss,
  calculateRescisao,
} from './calculations.ts'

describe('INSS progressivo (referência 2025)', () => {
  it('retorna 0 para salário zero ou negativo/inválido', () => {
    assert.equal(calculateProgressiveInss(0), 0)
    assert.equal(calculateProgressiveInss(-500), 0)
    assert.equal(calculateProgressiveInss(Number.NaN), 0)
  })

  it('calcula primeira faixa exatamente em 7,5%', () => {
    assert.equal(calculateProgressiveInss(1518.0), 113.85)
  })

  it('calcula progressivamente um salário intermediário (R$ 5.000,00)', () => {
    // 1518*0.075 + (2793.88-1518)*0.09 + (4190.83-2793.88)*0.12 + (5000-4190.83)*0.14 = 509.60
    assert.equal(calculateProgressiveInss(5000), 509.6)
  })

  it('respeita o teto previdenciário acima de R$ 8.157,41', () => {
    const atCap = calculateProgressiveInss(8157.41)
    const aboveCap = calculateProgressiveInss(25000)
    assert.equal(atCap, 951.63)
    assert.equal(aboveCap, atCap)
  })
})

describe('IRRF mensal (referência 2025)', () => {
  it('isenta salários dentro da faixa de isenção com desconto simplificado', () => {
    const result = calculateMonthlyIrrf(3000, calculateProgressiveInss(3000))
    assert.equal(result.usedSimplifiedDiscount, true)
    assert.equal(result.irrf, 0)
  })

  it('aplica desconto simplificado quando for maior que o INSS', () => {
    const inss = calculateProgressiveInss(5000) // 509.60 < 607.20
    const result = calculateMonthlyIrrf(5000, inss)
    assert.equal(result.usedSimplifiedDiscount, true)
    assert.equal(result.taxableBase, 4392.8)
    assert.equal(result.irrf, 312.89)
  })

  it('aplica dedução legal de INSS quando for maior que o desconto simplificado', () => {
    const inss = calculateProgressiveInss(10000) // 951.63 > 607.20
    const result = calculateMonthlyIrrf(10000, inss)
    assert.equal(result.usedSimplifiedDiscount, false)
    assert.equal(result.taxableBase, 9048.37)
    assert.equal(result.irrf, 1579.57)
  })
})

describe('CLT vs PJ', () => {
  it('calcula férias com terço exato (4/3 / 12) e respeita alíquota e contabilidade PJ editáveis', () => {
    const result = calculateCltVsPj({
      cltSalary: 6000,
      valeRefeicao: 800,
      planoSaude: 400,
      pjSalary: 10000,
      pjTaxRatePercent: 10,
      pjAccountingCost: 350,
    })

    assert.equal(result.clt.fgts, 480)
    assert.equal(result.clt.decimoTerceiroMes, 500)
    assert.equal(result.clt.feriasMes, 666.67)
    assert.equal(result.pj.taxAmount, 1000)
    assert.equal(result.pj.netMonthly, 8650)
  })

  it('sanitiza valores negativos, NaN e alíquota PJ acima de 100%', () => {
    const result = calculateCltVsPj({
      cltSalary: Number.NaN,
      valeRefeicao: -100,
      planoSaude: 0,
      pjSalary: 1000,
      pjTaxRatePercent: 150,
      pjAccountingCost: -50,
    })

    assert.equal(result.clt.netMonthly, 0)
    assert.equal(result.pj.taxRatePercent, 100)
    assert.equal(result.pj.netMonthly, 0)
  })
})

describe('Rescisão CLT (estimativa bruta)', () => {
  it('calcula demissão sem justa causa com aviso prévio indenizado e multa 40% FGTS', () => {
    const result = calculateRescisao({
      salarioBase: 3000,
      diasTrabalhadosMes: 15,
      mesesTrabalhadosAno: 6,
      motivo: 'sem_justa_causa',
      avisoPrevioIndenizado: true,
      saldoFgts: 5000,
    })

    assert.equal(result.saldoSalario, 1500)
    assert.equal(result.decimoTerceiro, 1500)
    assert.equal(result.feriasProporcionaisComTerco, 2000)
    assert.equal(result.avisoPrevio, 3000)
    assert.equal(result.multaFgts, 2000)
    assert.equal(result.totalBrutoEstimado, 10000)
  })

  it('zera aviso prévio indenizado e multa de FGTS em pedido de demissão', () => {
    const result = calculateRescisao({
      salarioBase: 3000,
      diasTrabalhadosMes: 10,
      mesesTrabalhadosAno: 6,
      motivo: 'pedido_demissao',
      avisoPrevioIndenizado: true,
      saldoFgts: 5000,
    })

    assert.equal(result.saldoSalario, 1000)
    assert.equal(result.avisoPrevio, 0)
    assert.equal(result.multaFgts, 0)
    assert.equal(result.totalBrutoEstimado, 4500)
  })

  it('limita dias a 0..30 e meses a 0..12', () => {
    const result = calculateRescisao({
      salarioBase: 3000,
      diasTrabalhadosMes: 45,
      mesesTrabalhadosAno: 18,
      motivo: 'pedido_demissao',
      avisoPrevioIndenizado: false,
      saldoFgts: 0,
    })

    assert.equal(result.saldoSalario, 3000)
    assert.equal(result.decimoTerceiro, 3000)
    assert.equal(result.feriasProporcionaisComTerco, 4000)
  })
})

describe('Juros compostos', () => {
  it('retorna juros zero quando a taxa anual é 0%', () => {
    const result = calculateCompoundInterest({
      valorInicial: 1000,
      aporteMensal: 200,
      taxaAnual: 0,
      anos: 2,
    })

    assert.equal(result.totalMeses, 24)
    assert.equal(result.totalInvestido, 5800)
    assert.equal(result.totalJuros, 0)
    assert.equal(result.saldoAcumulado, 5800)
  })

  it('calcula juros compostos anuais exatos sem aportes mensais', () => {
    const result = calculateCompoundInterest({
      valorInicial: 1000,
      aporteMensal: 0,
      taxaAnual: 10,
      anos: 2,
    })

    assert.equal(result.totalInvestido, 1000)
    assert.equal(result.saldoAcumulado, 1210)
    assert.equal(result.totalJuros, 210)
  })

  it('trata período zero e entradas inválidas com segurança', () => {
    const result = calculateCompoundInterest({
      valorInicial: 500,
      aporteMensal: 100,
      taxaAnual: Number.NaN,
      anos: 0,
    })

    assert.equal(result.totalMeses, 0)
    assert.equal(result.saldoAcumulado, 500)
    assert.equal(result.totalJuros, 0)
  })
})
