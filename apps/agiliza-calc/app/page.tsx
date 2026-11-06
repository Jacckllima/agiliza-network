import { CalculatorSuite } from '../components/CalculatorSuite'
import { Icon } from '@agiliza/ui'

export default function CalcPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center">
      <section className="text-center mb-8 w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 border border-blue-800/60 px-3.5 py-1 text-xs font-semibold text-blue-300 mb-3">
          <Icon name="calculator" className="h-4 w-4" />
          <span>CLT/PJ, rescisão e juros compostos</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          AgilizaCalc: simulações de CLT/PJ, rescisão e juros
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          Compare cenários de trabalho, estime valores de rescisão e simule juros compostos com os dados informados.
        </p>
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate-500">
          Os valores são estimativas. Confira as entradas e os parâmetros apresentados antes de usar o resultado.
        </p>
      </section>

      <section className="w-full">
        <CalculatorSuite />
      </section>

      {/* SEO Info Cards */}
      <section className="my-12 w-full grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'CLT vs PJ',
            desc: 'Compare o cenário CLT e PJ com as entradas e premissas usadas pela calculadora.',
          },
          {
            title: 'Rescisão Trabalhista',
            desc: 'Simule saldo de salário, férias, décimo terceiro, aviso prévio e multa do FGTS conforme os dados informados.',
          },
          {
            title: 'Juros Compostos',
            desc: 'Calcule uma projeção com valor inicial, taxa, período e aportes informados.',
          },
        ].map((item, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <h3 className="text-xs font-bold text-white mb-1">{item.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
