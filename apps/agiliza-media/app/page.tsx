import { MediaDownloader } from '../components/MediaDownloader'
import { Icon } from '@agiliza/ui'

export default function MediaPage() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center">
      <section className="text-center mb-8 w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-950 border border-blue-800/60 px-3 py-1 text-xs font-semibold text-blue-300 mb-3">
          <Icon name="video" className="h-4 w-4" />
          <span>Downloads indisponíveis nesta versão</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          AgilizaMedia: download de vídeos e áudios
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
          A integração para buscar e baixar arquivos de mídia ainda não está disponível.
        </p>
      </section>

      <section className="w-full">
        <MediaDownloader />
      </section>

    </div>
  )
}
