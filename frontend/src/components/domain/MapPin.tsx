import { formatPrecio } from '@/lib/format'
import { cn } from '@/lib/cn'

type Props = {
  label: string
  precioDesde: number
  active?: boolean
  onClick?: () => void
  className?: string
}

/**
 * Marcador de barbería para el mapa del portal (se monta sobre MapLibre en la tarea 6b).
 * Muestra el precio "desde" para comparar sin abrir cada barbería.
 */
export function MapPin({ label, precioDesde, active, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}, desde ${formatPrecio(precioDesde)}`}
      aria-pressed={active}
      className={cn('focus-ring group relative flex flex-col items-center rounded-full', className)}
    >
      <span
        className={cn(
          'tabular flex h-9 items-center rounded-full border px-3 text-sm font-bold shadow-2 transition-[background-color,color,border-color,scale] duration-(--dur-base) ease-out',
          active
            ? 'scale-110 border-accent bg-accent text-on-accent'
            : 'border-line-strong bg-surface-3 text-ivory group-hover:border-accent-line',
        )}
      >
        {formatPrecio(precioDesde)}
      </span>
      <span
        aria-hidden
        className={cn(
          '-mt-1 size-2.5 rotate-45 border-r border-b transition-colors duration-(--dur-base)',
          active ? 'border-accent bg-accent' : 'border-line-strong bg-surface-3',
        )}
      />
    </button>
  )
}
