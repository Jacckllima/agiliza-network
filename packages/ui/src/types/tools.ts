import type { IconName } from '../icon'

export type ToolId =
  | 'pdf'
  | 'media'
  | 'calc'
  | 'qr'
  | 'bio'
  | 'nota'
  | 'img'
  | 'text'
  | 'dev'
  | 'sign'

export interface ToolMeta {
  id: ToolId
  name: string
  label: string
  description: string
  href: string
  icon: IconName
}

export const TOOLS: ToolMeta[] = [
  {
    id: 'pdf',
    name: 'AgilizaPDF',
    label: 'PDF',
    description: 'Operações com PDFs indisponíveis nesta versão',
    href: 'https://pdf.agilizatools.com.br',
    icon: 'file',
  },
  {
    id: 'media',
    name: 'AgilizaMedia',
    label: 'Media',
    description: 'Downloads de mídia indisponíveis nesta versão',
    href: 'https://media.agilizatools.com.br',
    icon: 'video',
  },
  {
    id: 'calc',
    name: 'AgilizaCalc',
    label: 'Calc',
    description: 'Simula cenários CLT e PJ e estima valores de rescisão',
    href: 'https://calc.agilizatools.com.br',
    icon: 'calculator',
  },
  {
    id: 'qr',
    name: 'AgilizaQR',
    label: 'QR Code',
    description: 'Gera QR Codes para Pix, Wi-Fi, links, texto e contatos',
    href: 'https://qr.agilizatools.com.br',
    icon: 'qrCode',
  },
  {
    id: 'bio',
    name: 'AgilizaBio',
    label: 'Bio',
    description: 'Monta uma prévia local de uma página com seus links',
    href: 'https://bio.agilizatools.com.br',
    icon: 'link',
  },
  {
    id: 'nota',
    name: 'AgilizaNota',
    label: 'Nota',
    description: 'Gera recibos e declarações de conteúdo em PDF',
    href: 'https://nota.agilizatools.com.br',
    icon: 'receipt',
  },
  {
    id: 'img',
    name: 'AgilizaImg',
    label: 'Imagem',
    description: 'Redimensiona e converte imagens para WebP, JPG ou PNG',
    href: 'https://img.agilizatools.com.br',
    icon: 'image',
  },
  {
    id: 'text',
    name: 'AgilizaText',
    label: 'Texto',
    description: 'Conta caracteres e palavras, compara textos e formata JSON',
    href: 'https://text.agilizatools.com.br',
    icon: 'type',
  },
  {
    id: 'dev',
    name: 'AgilizaDev',
    label: 'Dev',
    description: 'Gera dados para testes, valida CPF e CNPJ e consulta CEP',
    href: 'https://dev.agilizatools.com.br',
    icon: 'code',
  },
  {
    id: 'sign',
    name: 'AgilizaSign',
    label: 'Assinar',
    description: 'Exportação de PDFs indisponível nesta versão',
    href: 'https://sign.agilizatools.com.br',
    icon: 'penTool',
  },
]
