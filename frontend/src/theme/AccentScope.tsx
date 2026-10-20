import type { CSSProperties, ReactNode } from 'react'
import { chequearAcento, normalizarHex } from './contrast'

type Props = {
  /** color_acento de la barbería. Si falta o no pasa AA, se usa el dorado de la plataforma. */
  color?: string | null
  className?: string
  children: ReactNode
}

/**
 * Aplica el acento de una barbería a todo lo que contiene.
 * Los tonos derivados (hover, soft, line) se recalculan solos en tokens.css.
 */
export function AccentScope({ color, className, children }: Props) {
  const hex = color ? normalizarHex(color) : null
  const usable = hex && chequearAcento(hex).valido ? hex : null
  const style = usable ? ({ '--accent': usable } as CSSProperties) : undefined

  return (
    <div data-accent-scope="" style={style} className={className}>
      {children}
    </div>
  )
}
