import { TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  label: string
  value: ReactNode
  /** Variación contra el período anterior, en %. Positivo = mejor. */
  delta?: number
  /** Texto del período comparado, ej. "vs. semana pasada". */
  deltaLabel?: string
  /** Invierte el significado del color (ej. ausencias: subir es malo). */
  invertDelta?: boolean
  footer?: ReactNode
  className?: string
}

export function MetricCard({ label, value, delta, deltaLabel, invertDelta, footer, className }: Props) {
  const sube = delta !== undefined && delta >= 0
  const bueno = invertDelta ? !sube : sube

  return (
    <div className={cn('flex flex-col rounded-lg border border-line bg-surface-1 p-5', className)}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="display tabular mt-3 text-4xl leading-none font-medium text-ivory">{value}</p>
      {delta !== undefined && (
        <p className="mt-3 flex items-center gap-1.5 text-sm">
          <span className={cn('inline-flex items-center gap-1 font-semibold', bueno ? 'text-success' : 'text-danger')}>
            {sube ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
            <span className="tabular">
              {sube ? '+' : '−'}
              {Math.abs(delta).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%
            </span>
          </span>
          {deltaLabel && <span className="text-subtle">{deltaLabel}</span>}
        </p>
      )}
      {footer && <div className="mt-4 border-t border-line pt-4 text-sm text-muted">{footer}</div>}
    </div>
  )
}
