import type { Metadata } from 'next'
import Link from 'next/link'
import { Container, Card, Icon, CONTACT_EMAIL, getToolHost } from '@agiliza/ui'

export const metadata: Metadata = {
  title: 'Termos e Condições de Uso | Agiliza Tools',
  description:
    'Condições de acesso, responsabilidades, limitações das estimativas financeiras e documentos gerados e regras de uso das ferramentas da Rede Agiliza.',
  alternates: { canonical: '/termos' },
}

export default function TermsOfUsePage() {
  const lastUpdated = '23 de novembro de 2026'

  return (
    <Container size="lg" className="py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Voltar ao início
        </Link>
      </nav>

      <header className="mb-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          <Icon name="file" className="h-3.5 w-3.5" />
          Condições de Uso
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Termos e Condições de Uso
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Última atualização: {lastUpdated}
        </p>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
          Estes termos estabelecem as condições de acesso e utilização do portal e das ferramentas
          disponibilizadas pela Rede Agiliza. Ao acessar ou utilizar qualquer aplicação da rede,
          você concorda com as regras descritas nesta página.
        </p>
      </header>

      <div className="space-y-8">
        {/* Seção 1: Escopo e Disponibilidade */}
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            1. Acesso, Escopo e Disponibilidade
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              As ferramentas da Rede Agiliza são oferecidas no estado em que se encontram, para uso
              direto no navegador e sem exigência de cadastro nesta versão.
            </p>
            <p>
              Não garantimos disponibilidade ininterrupta, ausência total de falhas ou manutenção
              permanente de recursos específicos. Funcionalidades podem ser ajustadas, suspensas ou
              descontinuadas conforme a evolução técnica do projeto.
            </p>
            <p>
              Nesta versão, nem todas as ferramentas listadas no portal possuem processamento ativo:
              Agiliza PDF ({getToolHost('pdf')}), Agiliza Assinador ({getToolHost('sign')}) e
              Agiliza Mídia ({getToolHost('media')}) exibem aviso de indisponibilidade, e Agiliza Bio
              ({getToolHost('bio')}) opera apenas como prévia local sem publicação de link
              compartilhável.
            </p>
          </div>
        </Card>

        {/* Seção 2: Limitações de Cálculos e Documentos */}
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            2. Limitações de Estimativas Financeiras e Documentos Gerados
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              <strong>Agiliza Calc ({getToolHost('calc')}):</strong> Os resultados exibidos em
              simulações de CLT, PJ, rescisão trabalhista e juros compostos são estimativas baseadas
              exclusivamente nas premissas informadas na tela. Eles não substituem aconselhamento
              contábil, tributário, financeiro ou jurídico, nem garantem valores oficiais perante
              órgãos públicos, empregadores ou instituições financeiras.
            </p>
            <p>
              <strong>Agiliza Nota ({getToolHost('nota')}):</strong> Os recibos, declarações de
              conteúdo e DANFEs gerados em PDF a partir de XML servem apenas como apoio gráfico e de
              conferência a partir dos dados fornecidos pelo próprio usuário. O DANFE gerado não
              substitui o arquivo XML fiscal oficial nem realiza emissão ou transmissão perante a SEFAZ.
              A veracidade das informações, a adequação fiscal e a validade legal dos documentos são de
              responsabilidade exclusiva de quem os emite.
            </p>
            <p>
              <strong>Agiliza Dev ({getToolHost('dev')}):</strong> Geradores de CPF e CNPJ destinam-se
              exclusivamente a testes de desenvolvimento e validação de sistemas. É proibido utilizar
              dados gerados para fraude, falsidade ideológica ou qualquer finalidade ilícita.
            </p>
          </div>
        </Card>

        {/* Seção 3: Uso Permitido, Conteúdo e Mídia */}
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            3. Uso Permitido, Responsabilidade sobre Conteúdo e Mídia
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              Você é integralmente responsável pelos textos, imagens, chaves Pix, credenciais Wi-Fi,
              links e arquivos que inserir ou processar nas ferramentas (como Agiliza QR, Agiliza Img
              e Agiliza Text), devendo garantir que possui autorização ou direitos necessários sobre
              esse material.
            </p>
            <p>
              <strong>Mídia e direitos autorais:</strong> O Agiliza Mídia ({getToolHost('media')})
              não realiza download de arquivos de plataformas externas nesta versão. Caso um fluxo de
              extração venha a ser habilitado no futuro, o uso continuará sujeito aos direitos
              autorais aplicáveis e aos termos de serviço das plataformas de origem, sendo vedado
              baixar ou redistribuir conteúdo protegido sem autorização.
            </p>
            <p>
              Não é permitido tentar explorar vulnerabilidades, automatizar requisições abusivas ou
              utilizar o portal de forma que comprometa a estabilidade da infraestrutura.
            </p>
          </div>
        </Card>

        {/* Seção 4: Serviços de Terceiros e Privacidade */}
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            4. Serviços de Terceiros e Privacidade
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              A infraestrutura de hospedagem é fornecida pela Vercel e a consulta de CEP no Agiliza
              Dev utiliza a API pública do ViaCEP (<code>viacep.com.br</code>). A Rede Agiliza não
              controla a disponibilidade nem as políticas desses serviços externos.
            </p>
            <p>
              Para detalhes sobre como os dados são tratados no navegador e em serviços externos,
              consulte a nossa{' '}
              <Link
                href="/privacidade"
                className="font-medium text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
              >
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </Card>

        {/* Seção 5: Alterações e Suporte */}
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            5. Atualizações destes Termos e Canal de Contato
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              Estes termos podem ser revisados sempre que novas funcionalidades forem lançadas ou
              quando houver necessidade de adequação legal. A data da última atualização permanece
              indicada no topo da página.
            </p>
            <p>
              Dúvidas sobre o funcionamento das ferramentas, relatos de erro ou solicitações
              relacionadas a estes termos podem ser enviados para{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
              >
                {CONTACT_EMAIL}
              </a>
              , pelo repositório oficial no GitHub (
              <a
                href="https://github.com/agilizatoolsoficial/agiliza-network"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
              >
                github.com/agilizatoolsoficial/agiliza-network
              </a>
              ) ou pela página de{' '}
              <Link
                href="/contato"
                className="font-medium text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
              >
                Contato
              </Link>
              .
            </p>
          </div>
        </Card>
      </div>
    </Container>
  )
}
