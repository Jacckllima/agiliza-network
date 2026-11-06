import { BioBuilder } from '../components/BioBuilder'
import { Icon } from '@agiliza/ui'

export default function BioPage() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center">
      <section className="text-center mb-8 w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-950 border border-blue-800/60 px-3 py-1 text-xs font-semibold text-blue-300 mb-3">
          <Icon name="link" className="h-4 w-4" />
          <span>Prévia local, sem publicação</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          AgilizaBio: prévia de página com links
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          Monte e visualize uma página com seus links. O perfil não é publicado e não recebe um endereço compartilhável.
        </p>
      </section>

      <section className="w-full">
        <BioBuilder />
      </section>
    </div>
  )
}
