import type { IconName } from '../icon'
import { TOOL_URLS } from '../config/urls'

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
    href: TOOL_URLS.pdf,
    icon: 'file',
  },
  {
    id: 'media',
    name: 'AgilizaMedia',
    label: 'Media',
    description: 'Downloads de mídia indisponíveis nesta versão',
    href: TOOL_URLS.media,
    icon: 'video',
  },
  {
    id: 'calc',
    name: 'AgilizaCalc',
    label: 'Calc',
    description: 'Simula cenários CLT e PJ e estima valores de rescisão',
    href: TOOL_URLS.calc,
    icon: 'calculator',
  },
  {
    id: 'qr',
    name: 'AgilizaQR',
    label: 'QR Code',
    description: 'Gera QR Codes para Pix, Wi-Fi, links, texto e contatos',
    href: TOOL_URLS.qr,
    icon: 'qrCode',
  },
  {
    id: 'bio',
    name: 'AgilizaBio',
    label: 'Bio',
    description: 'Monta uma prévia local de uma página com seus links',
    href: TOOL_URLS.bio,
    icon: 'link',
  },
  {
    id: 'nota',
    name: 'AgilizaNota',
    label: 'Nota',
    description: 'Gera recibos, declarações de conteúdo e DANFE de NF-e em PDF',
    href: TOOL_URLS.nota,
    icon: 'receipt',
  },
  {
    id: 'img',
    name: 'AgilizaImg',
    label: 'Imagem',
    description: 'Redimensiona e converte imagens para WebP, JPG ou PNG',
    href: TOOL_URLS.img,
    icon: 'image',
  },
  {
    id: 'text',
    name: 'AgilizaText',
    label: 'Texto',
    description: 'Conta caracteres e palavras, compara textos e formata JSON',
    href: TOOL_URLS.text,
    icon: 'type',
  },
  {
    id: 'dev',
    name: 'AgilizaDev',
    label: 'Dev',
    description: 'Gera dados para testes, valida CPF e CNPJ e consulta CEP',
    href: TOOL_URLS.dev,
    icon: 'code',
  },
  {
    id: 'sign',
    name: 'AgilizaSign',
    label: 'Assinar',
    description: 'Exportação de PDFs indisponível nesta versão',
    href: TOOL_URLS.sign,
    icon: 'penTool',
  },
]
