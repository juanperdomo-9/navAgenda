import { formatPrecio } from '@/lib/format'
import { cn } from '@/lib/cn'

type Props = {
  amount: number
  /** Precio tachado (ej. antes de aplicar el beneficio). */
  strike?: boolean
  /** Antepone "desde" (para listados con rango de precios). */
  from?: boolean
  className?: string
}

export function Price({ amount, strike, from, className }: Props) {
  return (
    <span className={cn('tabular whitespace-nowrap', strike && 'text-subtle line-through', className)}>
      {from && <span className="mr-1 text-[0.85em] font-normal text-subtle">desde</span>}
      {formatPrecio(amount)}
    </span>
  )
}
