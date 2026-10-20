import { Ban, Check, Clock, Lock, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

export type EstadoTurno = 'reservado' | 'asistio' | 'no_asistio' | 'cancelado' | 'bloqueo'

/** Color + ícono + texto: el estado nunca depende solo del color. */
export const ESTADOS: Record<EstadoTurno, { label: string; color: string; Icon: typeof Clock }> = {
  reservado: { label: 'Reservado', color: 'var(--st-reservado)', Icon: Clock },
  asistio: { label: 'Asistió', color: 'var(--st-asistio)', Icon: Check },
  no_asistio: { label: 'No asistió', color: 'var(--st-ausente)', Icon: X },
  cancelado: { label: 'Cancelado', color: 'var(--st-cancelado)', Icon: Ban },
  bloqueo: { label: 'Bloqueado', color: 'var(--text-muted)', Icon: Lock },
}

type Props = { estado: EstadoTurno; className?: string }

export function StatusPill({ estado, className }: Props) {
  const { label, color, Icon } = ESTADOS[estado]
  return (
    <span
      style={{ '--st': color } as CSSProperties}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
        'bg-[color-mix(in_oklch,var(--st)_14%,var(--surface-1))] text-(--st)',
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.5} aria-hidden />
      {label}
    </span>
  )
}
