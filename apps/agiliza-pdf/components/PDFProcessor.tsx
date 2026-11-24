'use client'

import { useState } from 'react'
import { Card, Icon, type IconName } from '@agiliza/ui'
import { OrganizePdfPanel } from './OrganizePdfPanel'
import { ConvertFromPdfPanel } from './ConvertFromPdfPanel'
import { ConvertToPdfPanel } from './ConvertToPdfPanel'
import { SignPdfPanel } from './SignPdfPanel'
import { EditPdfPanel } from './EditPdfPanel'
import { SecurityOcrPanel } from './SecurityOcrPanel'
import { OptimizePdfPanel } from './OptimizePdfPanel'

export type PdfWorkspaceTab =
  | 'organizar'
  | 'de-pdf'
  | 'para-pdf'
  | 'assinar'
  | 'editar'
  | 'seguranca'
  | 'comprimir'

interface TabDefinition {
  id: PdfWorkspaceTab
  label: string
  icon: IconName
  title: string
  description: string
}

const WORKSPACE_TABS = [
  {
    id: 'organizar',
    label: 'Organizar',
    icon: 'scissors',
    title: 'Organizar PDF (juntar, dividir, girar e remover páginas)',
    description:
      'Junte múltiplos PDFs na ordem desejada, extraia intervalos de páginas, gire ou remova páginas diretamente no navegador.',
  },
  {
    id: 'de-pdf',
    label: 'Converter de PDF',
    icon: 'image',
    title: 'Converter de PDF (JPG, PNG, texto e Markdown)',
    description:
      'Exporte páginas de um PDF como imagem, extraia texto puro ou converta para Markdown diretamente no navegador.',
  },
  {
    id: 'para-pdf',
    label: 'Converter em PDF',
    icon: 'file',
    title: 'Converter em PDF (imagens, texto, HTML e CSV)',
    description:
      'Monte um arquivo PDF A4 a partir de imagens, texto, código HTML ou planilhas CSV sem enviar arquivos para servidores.',
  },
  {
    id: 'assinar',
    label: 'Assinar PDF',
    icon: 'penTool',
    title: 'Assinar PDF (assinatura visual no navegador)',
    description:
      'Adicione assinatura visual desenhada, digitada ou por imagem PNG sobre páginas de um PDF. Não substitui certificado digital ICP-Brasil.',
  },
  {
    id: 'editar',
    label: 'Editar',
    icon: 'type',
    title: 'Edição avançada (numeração, marca d água, recortar e formulários)',
    description:
      'Insira números de página, marca d água, recorte margens, achate formulários, tarje áreas sensíveis ou compare dois PDFs.',
  },
  {
    id: 'seguranca',
    label: 'Segurança e OCR',
    icon: 'shield',
    title: 'Segurança, Scanner e OCR no navegador',
    description:
      'Proteja ou desbloqueie PDF com senha, digitalize pela câmera e execute reconhecimento de texto (OCR) localmente.',
  },
  {
    id: 'comprimir',
    label: 'Comprimir',
    icon: 'bolt',
    title: 'Comprimir e otimizar PDF',
    description:
      'Reduza o tamanho do arquivo localmente com transparência sobre ganho real de bytes e trade-offs de qualidade.',
  },
] as const satisfies readonly TabDefinition[]

const WORKSPACE_TABS_BY_ID: Record<PdfWorkspaceTab, TabDefinition> = {
  organizar: WORKSPACE_TABS[0],
  'de-pdf': WORKSPACE_TABS[1],
  'para-pdf': WORKSPACE_TABS[2],
  assinar: WORKSPACE_TABS[3],
  editar: WORKSPACE_TABS[4],
  seguranca: WORKSPACE_TABS[5],
  comprimir: WORKSPACE_TABS[6],
}

export function PDFProcessor() {
  const [activeTab, setActiveTab] = useState<PdfWorkspaceTab>('organizar')

  const currentTab = WORKSPACE_TABS_BY_ID[activeTab]

  return (
    <div className="w-full space-y-6">
      {/* Barra de abas acessíveis */}
      <div
        role="tablist"
        aria-label="Categorias de operações com PDF"
        className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900 p-2"
      >
        {WORKSPACE_TABS.map((tab) => {
          const isSelected = tab.id === activeTab
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon name={tab.icon} className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Painel ativo */}
      <Card
        id={`panel-${currentTab.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${currentTab.id}`}
        variant="elevated"
        padding="lg"
        className="w-full space-y-6"
      >
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-white">{currentTab.title}</h2>
          <p className="text-sm text-slate-400">{currentTab.description}</p>
        </div>

        {currentTab.id === 'organizar' ? (
          <OrganizePdfPanel />
        ) : currentTab.id === 'de-pdf' ? (
          <ConvertFromPdfPanel />
        ) : currentTab.id === 'para-pdf' ? (
          <ConvertToPdfPanel />
        ) : currentTab.id === 'assinar' ? (
          <SignPdfPanel />
        ) : currentTab.id === 'editar' ? (
          <EditPdfPanel />
        ) : currentTab.id === 'seguranca' ? (
          <SecurityOcrPanel />
        ) : (
          <OptimizePdfPanel />
        )}
      </Card>
    </div>
  )
}
