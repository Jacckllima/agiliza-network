'use client'

import { useEffect, useRef } from 'react'

declare const process: { env?: Record<string, string | undefined> } | undefined

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export interface AdSlotProps {
  /** ID do bloco de anúncio no AdSense (ex.: "1234567890" ou identificador lógico) */
  slot: string
  /** Formato responsivo do AdSense */
  format?: 'auto' | 'horizontal' | 'rectangle'
  /** Desativa explicitamente o anúncio (ex.: usuários de plano pago futuro ou páginas sem anúncios) */
  disabled?: boolean
  /** Classes extras de layout */
  className?: string
  /** Client ID opcional para testes ou sobrescrita; por padrão lê NEXT_PUBLIC_ADSENSE_CLIENT */
  clientId?: string
}

/**
 * Espaço reservado para anúncios (Google AdSense).
 * Permanece completamente desativado (retorna null, sem scripts nem cookies)
 * enquanto NEXT_PUBLIC_ADSENSE_CLIENT não estiver configurado ou quando disabled=true.
 */
export function AdSlot({
  slot,
  format = 'auto',
  disabled = false,
  className = '',
  clientId,
}: AdSlotProps) {
  const pushedRef = useRef(false)
  const resolvedClient =
    clientId ??
    (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_ADSENSE_CLIENT : undefined)

  const isEnabled = Boolean(!disabled && resolvedClient && slot)

  useEffect(() => {
    if (!isEnabled || pushedRef.current || typeof window === 'undefined') return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
      pushedRef.current = true
    } catch {
      // Silencioso caso o script externo esteja bloqueado ou ainda não carregado
    }
  }, [isEnabled])

  if (!isEnabled) {
    return null
  }

  return (
    <aside
      aria-label="Publicidade"
      className={`w-full overflow-hidden print:hidden ${className}`.trim()}
    >
      <ins
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={resolvedClient}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  )
}
