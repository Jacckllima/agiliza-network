import { DevSuite } from '../components/DevSuite'
import { Icon } from '@agiliza/ui'

export default function DevPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center">
      <section className="text-center mb-8 w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-950 border border-blue-800/60 px-3.5 py-1 text-xs font-semibold text-blue-300 mb-3">
          <Icon name="code" className="h-4 w-4" />
          <span>Dados para testes, validação de documentos, CEP e Base64</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          AgilizaDev: dados de teste e utilitários de desenvolvimento
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          Gere dados de CPF e CNPJ para testes, valide os dígitos, consulte endereços por CEP e converta texto para Base64.
        </p>
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-amber-300">
          Os dados gerados servem para testes. Não os use como documentos de pessoas ou empresas reais.
        </p>
      </section>

      <section className="w-full">
        <DevSuite />
      </section>
    </div>
  )
}
