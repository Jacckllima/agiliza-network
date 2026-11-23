import type { ToolId } from '../types/tools'

declare const process: { env?: Record<string, string | undefined> } | undefined

function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, '')
}

export const DEFAULT_PORTAL_URL = 'https://agiliza-network.vercel.app'
export const DEFAULT_CONTACT_EMAIL = 'agilizatools.oficial@gmail.com'
export const GITHUB_REPO_URL = 'https://github.com/agilizatoolsoficial/agiliza-network'
export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`

export const DEFAULT_TOOL_URLS: Record<ToolId, string> = {
  pdf: 'https://agiliza-pdf.vercel.app',
  media: 'https://agiliza-media.vercel.app',
  calc: 'https://agiliza-calc.vercel.app',
  qr: 'https://agiliza-qr.vercel.app',
  bio: 'https://agiliza-bio.vercel.app',
  nota: 'https://agiliza-nota.vercel.app',
  img: 'https://agiliza-img.vercel.app',
  text: 'https://agiliza-text.vercel.app',
  dev: 'https://agiliza-dev.vercel.app',
  sign: 'https://agiliza-sign.vercel.app',
}

export const PORTAL_URL = normalizeOrigin(
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_PORTAL_URL : undefined) ||
    DEFAULT_PORTAL_URL,
)

export const CONTACT_EMAIL =
  (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_CONTACT_EMAIL : undefined) ||
  DEFAULT_CONTACT_EMAIL

export const TOOL_URLS: Record<ToolId, string> = {
  pdf: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_PDF_URL : undefined) ||
      DEFAULT_TOOL_URLS.pdf,
  ),
  media: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_MEDIA_URL : undefined) ||
      DEFAULT_TOOL_URLS.media,
  ),
  calc: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_CALC_URL : undefined) ||
      DEFAULT_TOOL_URLS.calc,
  ),
  qr: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_QR_URL : undefined) ||
      DEFAULT_TOOL_URLS.qr,
  ),
  bio: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_BIO_URL : undefined) ||
      DEFAULT_TOOL_URLS.bio,
  ),
  nota: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_NOTA_URL : undefined) ||
      DEFAULT_TOOL_URLS.nota,
  ),
  img: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_IMG_URL : undefined) ||
      DEFAULT_TOOL_URLS.img,
  ),
  text: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_TEXT_URL : undefined) ||
      DEFAULT_TOOL_URLS.text,
  ),
  dev: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_DEV_URL : undefined) ||
      DEFAULT_TOOL_URLS.dev,
  ),
  sign: normalizeOrigin(
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_TOOL_SIGN_URL : undefined) ||
      DEFAULT_TOOL_URLS.sign,
  ),
}

export function getToolUrl(toolId: ToolId): string {
  return TOOL_URLS[toolId]
}

export function getToolHost(toolId: ToolId): string {
  return new URL(TOOL_URLS[toolId]).host
}

export function getPortalHost(): string {
  return new URL(PORTAL_URL).host
}
