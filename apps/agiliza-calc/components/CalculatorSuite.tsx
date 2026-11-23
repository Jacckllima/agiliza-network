'use client'

import { useState, useMemo } from 'react'
import { Card, Icon } from '@agiliza/ui'
import type { IconName } from '@agiliza/ui'
import {
  CALC_PARAMETER_METADATA,
  calculateCltVsPj,
  calculateCompoundInterest,
  calculateRescisao,
} from '../lib/calculations'
import type { RescisaoReason } from '../lib/calculations'

type CalcTab = 'clt_pj' | 'rescisao' | 'juros'

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function CalculatorSuite() {
  const [activeTab, setActiveTab] = useState<CalcTab>('clt_pj')

  // --- CLT vs PJ State ---
  const [cltSalary, setCltSalary] = useState<number>(5000)
  const [pjSalary, setPjSalary] = useState<number>(8000)
  const [valeRefeicao, setValeRefeicao] = useState<number>(800)
  const [planoSaude, setPlanoSaude] = useState<number>(400)
  const [pjTaxRatePercent, setPjTaxRatePercent] = useState<number>(6)
  const [pjAccountingCost, setPjAccountingCost] = useState<number>(200)

  const cltVsPj = useMemo(
    () =>
      calculateCltVsPj({
        cltSalary,
        valeRefeicao,
        planoSaude,
        pjSalary,
        pjTaxRatePercent,
        pjAccountingCost,
      }),
    [cltSalary, valeRefeicao, planoSaude, pjSalary, pjTaxRatePercent, pjAccountingCost],
  )

  // --- Rescisão State ---
  const [salarioBase, setSalarioBase] = useState<number>(4000)
  const [diasTrabalhadosMes, setDiasTrabalhadosMes] = useState<number>(15)
  const [mesesTrabalhados, setMesesTrabalhados] = useState<number>(10)
  const [motivoRescisao, setMotivoRescisao] = useState<RescisaoReason>('sem_justa_causa')
  const [avisoPrevioIndenizado, setAvisoPrevioIndenizado] = useState<boolean>(true)
  const [saldoFgts, setSaldoFgts] = useState<number>(3200)

  const rescisaoMetrics = useMemo(
    () =>
      calculateRescisao({
        salarioBase,
        diasTrabalhadosMes,
        mesesTrabalhadosAno: mesesTrabalhados,
        motivo: motivoRescisao,
        avisoPrevioIndenizado,
        saldoFgts,
      }),
    [salarioBase, diasTrabalhadosMes, mesesTrabalhados, motivoRescisao, avisoPrevioIndenizado, saldoFgts],
  )

  // --- Juros Compostos State ---
  const [valorInicial, setValorInicial] = useState<number>(1000)
  const [aporteMensal, setAporteMensal] = useState<number>(500)
  const [taxaAnual, setTaxaAnual] = useState<number>(12)
  const [anos, setAnos] = useState<number>(5)

  const jurosMetrics = useMemo(
    () =>
      calculateCompoundInterest({
        valorInicial,
        aporteMensal,
        taxaAnual,
        anos,
      }),
    [valorInicial, aporteMensal, taxaAnual, anos],
  )

  return (
    <Card variant="elevated" padding="lg" className="w-full">
      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2 mb-8 bg-slate-950 p-1.5 rounded-xl border border-slate-800" role="tablist">
        {[
          { id: 'clt_pj', label: 'CLT vs PJ', icon: 'scale' },
          { id: 'rescisao', label: 'Rescisão CLT', icon: 'file' },
          { id: 'juros', label: 'Juros Compostos', icon: 'calculator' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id as CalcTab)}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Icon name={tab.icon as IconName} className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 1. CLT vs PJ Calculator */}
      {activeTab === 'clt_pj' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input CLT */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <Icon name="building" className="h-4 w-4" /> Proposta CLT
              </h3>
              <div>
                <label htmlFor="clt-salary" className="block text-xs text-slate-400 mb-1">
                  Salário Bruto CLT (R$):
                </label>
                <input
                  id="clt-salary"
                  type="number"
                  min={0}
                  value={cltSalary}
                  onChange={(e) => setCltSalary(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="clt-vr" className="block text-xs text-slate-400 mb-1">
                    Vale Refeição (R$):
                  </label>
                  <input
                    id="clt-vr"
                    type="number"
                    min={0}
                    value={valeRefeicao}
                    onChange={(e) => setValeRefeicao(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label htmlFor="clt-saude" className="block text-xs text-slate-400 mb-1">
                    Plano Saúde (R$):
                  </label>
                  <input
                    id="clt-saude"
                    type="number"
                    min={0}
                    value={planoSaude}
                    onChange={(e) => setPlanoSaude(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Input PJ */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Icon name="rocket" className="h-4 w-4" /> Proposta PJ
              </h3>
              <div>
                <label htmlFor="pj-salary" className="block text-xs text-slate-400 mb-1">
                  Faturamento Mensal PJ (R$):
                </label>
                <input
                  id="pj-salary"
                  type="number"
                  min={0}
                  value={pjSalary}
                  onChange={(e) => setPjSalary(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pj-tax" className="block text-xs text-slate-400 mb-1">
                    Alíquota de imposto (%):
                  </label>
                  <input
                    id="pj-tax"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={pjTaxRatePercent}
                    onChange={(e) =>
                      setPjTaxRatePercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label htmlFor="pj-accounting" className="block text-xs text-slate-400 mb-1">
                    Contabilidade/mês (R$):
                  </label>
                  <input
                    id="pj-accounting"
                    type="number"
                    min={0}
                    value={pjAccountingCost}
                    onChange={(e) => setPjAccountingCost(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ajuste a alíquota conforme seu enquadramento (Anexo III, Anexo V, Fator R ou Lucro Presumido) e inclua pró-labore/INSS se aplicável.
              </p>
            </div>
          </div>

          {/* Results Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div className="bg-blue-950/40 border border-blue-500/30 p-5 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">Estimativa CLT</h4>
              <p className="text-2xl font-extrabold text-white">
                R$ {formatBRL(cltVsPj.clt.netMonthly)}
                <span className="text-xs font-normal text-slate-400"> /mês líquido + benefícios</span>
              </p>
              <p className="text-xs text-blue-300">
                Equivalente mensal com FGTS, 13º e Férias + 1/3: <strong>R$ {formatBRL(cltVsPj.clt.totalRealValue)}</strong>
              </p>
              <dl className="grid grid-cols-2 gap-2 pt-3 border-t border-blue-900/60 text-[11px] text-slate-300">
                <div>
                  <dt className="text-slate-400">INSS (progressivo)</dt>
                  <dd className="font-semibold">- R$ {formatBRL(cltVsPj.clt.inss)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">
                    IRRF ({cltVsPj.clt.usedSimplifiedIrrfDiscount ? 'desc. simplificado' : 'dedução INSS'})
                  </dt>
                  <dd className="font-semibold">- R$ {formatBRL(cltVsPj.clt.irrf)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">FGTS (8%/mês)</dt>
                  <dd className="font-semibold">+ R$ {formatBRL(cltVsPj.clt.fgts)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">13º + Férias com 1/3 (mês)</dt>
                  <dd className="font-semibold">
                    + R$ {formatBRL(cltVsPj.clt.decimoTerceiroMes + cltVsPj.clt.feriasMes)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-cyan-950/40 border border-cyan-500/30 p-5 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Estimativa PJ</h4>
              <p className="text-2xl font-extrabold text-white">
                R$ {formatBRL(cltVsPj.pj.netMonthly)}
                <span className="text-xs font-normal text-slate-400"> /mês líquido estimado</span>
              </p>
              <p className="text-xs text-cyan-300">
                {cltVsPj.monthlyDifferencePjMinusCltTotal > 0
                  ? `Diferença estimada: + R$ ${formatBRL(cltVsPj.monthlyDifferencePjMinusCltTotal)}/mês a favor do PJ.`
                  : cltVsPj.monthlyDifferencePjMinusCltTotal < 0
                    ? `Diferença estimada: + R$ ${formatBRL(Math.abs(cltVsPj.monthlyDifferencePjMinusCltTotal))}/mês a favor do pacote CLT.`
                    : 'Os dois cenários apresentam retorno mensal equivalente com as premissas informadas.'}
              </p>
              <dl className="grid grid-cols-2 gap-2 pt-3 border-t border-cyan-900/60 text-[11px] text-slate-300">
                <div>
                  <dt className="text-slate-400">Imposto ({cltVsPj.pj.taxRatePercent}%)</dt>
                  <dd className="font-semibold">- R$ {formatBRL(cltVsPj.pj.taxAmount)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Contabilidade</dt>
                  <dd className="font-semibold">- R$ {formatBRL(cltVsPj.pj.accountingCost)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-[11px] leading-relaxed text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Premissas e referências usadas nesta estimativa:</p>
            <p>
              • {CALC_PARAMETER_METADATA.inss.label}: {CALC_PARAMETER_METADATA.inss.source} (vigência a partir de {CALC_PARAMETER_METADATA.inss.effectiveFrom}).
            </p>
            <p>
              • {CALC_PARAMETER_METADATA.irrf.label}: {CALC_PARAMETER_METADATA.irrf.source} (vigência a partir de {CALC_PARAMETER_METADATA.irrf.effectiveFrom}). Não considera dependentes, pensão alimentícia ou descontos sindicais.
            </p>
            <p>
              • {CALC_PARAMETER_METADATA.fgts.label}: {CALC_PARAMETER_METADATA.fgts.source}. Férias mensais calculadas com terço constitucional exato (4/3 ÷ 12).
            </p>
            <p>
              • Resultado meramente estimativo. Não substitui conferência com contador, RH ou advogado trabalhista.
            </p>
          </div>
        </div>
      )}

      {/* 2. Rescisão Calculator */}
      {activeTab === 'rescisao' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <div>
              <label htmlFor="rescisao-motivo" className="block text-xs text-slate-400 mb-1">
                Motivo do desligamento:
              </label>
              <select
                id="rescisao-motivo"
                value={motivoRescisao}
                onChange={(e) => setMotivoRescisao(e.target.value as RescisaoReason)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              >
                <option value="sem_justa_causa">Demissão sem justa causa</option>
                <option value="pedido_demissao">Pedido de demissão</option>
              </select>
            </div>
            <div>
              <label htmlFor="rescisao-salario" className="block text-xs text-slate-400 mb-1">
                Último Salário Bruto (R$):
              </label>
              <input
                id="rescisao-salario"
                type="number"
                min={0}
                value={salarioBase}
                onChange={(e) => setSalarioBase(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="rescisao-dias" className="block text-xs text-slate-400 mb-1">
                Dias trabalhados no mês da saída (0 a 30):
              </label>
              <input
                id="rescisao-dias"
                type="number"
                min={0}
                max={30}
                value={diasTrabalhadosMes}
                onChange={(e) =>
                  setDiasTrabalhadosMes(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="rescisao-meses" className="block text-xs text-slate-400 mb-1">
                Meses proporcionais no ano/período (0 a 12):
              </label>
              <input
                id="rescisao-meses"
                type="number"
                min={0}
                max={12}
                value={mesesTrabalhados}
                onChange={(e) =>
                  setMesesTrabalhados(Math.max(0, Math.min(12, Number(e.target.value) || 0)))
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="rescisao-fgts" className="block text-xs text-slate-400 mb-1">
                Saldo de FGTS acumulado (R$):
              </label>
              <input
                id="rescisao-fgts"
                type="number"
                min={0}
                disabled={motivoRescisao !== 'sem_justa_causa'}
                value={saldoFgts}
                onChange={(e) => setSaldoFgts(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white disabled:opacity-50"
              />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="aviso"
                disabled={motivoRescisao !== 'sem_justa_causa'}
                checked={motivoRescisao === 'sem_justa_causa' && avisoPrevioIndenizado}
                onChange={(e) => setAvisoPrevioIndenizado(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <label htmlFor="aviso" className="text-xs text-slate-300 cursor-pointer">
                Aviso prévio indenizado (30 dias base)
              </label>
            </div>
          </div>

          <div className="bg-blue-950/40 border border-blue-500/30 p-6 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">
              Estimativa Bruta da Rescisão
            </h4>
            <p className="text-3xl font-extrabold text-white">
              R$ {formatBRL(rescisaoMetrics.totalBrutoEstimado)}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
              <div>
                <span>Saldo Salário:</span>
                <p className="font-bold text-white">R$ {formatBRL(rescisaoMetrics.saldoSalario)}</p>
              </div>
              <div>
                <span>13º Proporcional:</span>
                <p className="font-bold text-white">R$ {formatBRL(rescisaoMetrics.decimoTerceiro)}</p>
              </div>
              <div>
                <span>Férias + 1/3:</span>
                <p className="font-bold text-white">
                  R$ {formatBRL(rescisaoMetrics.feriasProporcionaisComTerco)}
                </p>
              </div>
              <div>
                <span>Aviso Prévio:</span>
                <p className="font-bold text-white">R$ {formatBRL(rescisaoMetrics.avisoPrevio)}</p>
              </div>
              <div>
                <span>Multa 40% FGTS:</span>
                <p className="font-bold text-white">R$ {formatBRL(rescisaoMetrics.multaFgts)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-[11px] leading-relaxed text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Premissas e limitações desta estimativa:</p>
            <p>
              • Valores brutos estimados sem descontos de INSS/IRRF sobre verbas rescisórias e sem incluir férias vencidas, adicional de 3 dias por ano trabalhado (Lei nº 12.506/2011), horas extras ou convenções coletivas.
            </p>
            <p>
              • No pedido de demissão, não são incluídos aviso prévio indenizado pelo empregador nem multa de 40% do FGTS.
            </p>
            <p>
              • Resultado meramente estimativo. Confira o termo de rescisão com o RH, sindicato ou advogado trabalhista.
            </p>
          </div>
        </div>
      )}

      {/* 3. Juros Compostos */}
      {activeTab === 'juros' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <div>
              <label htmlFor="juros-inicial" className="block text-xs text-slate-400 mb-1">
                Valor Inicial (R$):
              </label>
              <input
                id="juros-inicial"
                type="number"
                min={0}
                value={valorInicial}
                onChange={(e) => setValorInicial(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="juros-aporte" className="block text-xs text-slate-400 mb-1">
                Aporte Mensal (R$):
              </label>
              <input
                id="juros-aporte"
                type="number"
                min={0}
                value={aporteMensal}
                onChange={(e) => setAporteMensal(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="juros-taxa" className="block text-xs text-slate-400 mb-1">
                Taxa Anual (%):
              </label>
              <input
                id="juros-taxa"
                type="number"
                min={0}
                max={1000}
                step={0.1}
                value={taxaAnual}
                onChange={(e) => setTaxaAnual(Math.min(1000, Math.max(0, Number(e.target.value) || 0)))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label htmlFor="juros-anos" className="block text-xs text-slate-400 mb-1">
                Período (Anos, 0 a 100):
              </label>
              <input
                id="juros-anos"
                type="number"
                min={0}
                max={100}
                value={anos}
                onChange={(e) => setAnos(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400">Total Investido</span>
              <p className="text-xl font-bold text-white mt-1">
                R$ {formatBRL(jurosMetrics.totalInvestido)}
              </p>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-5 rounded-2xl">
              <span className="text-xs text-emerald-300">Total em Juros Ganhos</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">
                R$ {formatBRL(jurosMetrics.totalJuros)}
              </p>
            </div>
            <div className="bg-blue-950/40 border border-blue-500/30 p-5 rounded-2xl">
              <span className="text-xs text-blue-300">Montante Final Acumulado</span>
              <p className="text-2xl font-extrabold text-white mt-1">
                R$ {formatBRL(jurosMetrics.saldoAcumulado)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-[11px] leading-relaxed text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Premissas do cálculo:</p>
            <p>
              • Taxa mensal equivalente composta: {jurosMetrics.taxaMensalEquivalentePercent.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}% ao mês ({jurosMetrics.totalMeses} meses), com aportes aplicados ao final de cada mês.
            </p>
            <p>
              • Projeção matemática bruta: não desconta imposto de renda, taxas administrativas nem inflação.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
