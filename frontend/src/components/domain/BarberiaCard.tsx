import { ArrowUpRight, MapPin } from 'lucide-react'
import { AccentScope } from '@/theme/AccentScope'
import { Price } from '@/components/ui/Price'
import { cn } from '@/lib/cn'

export type BarberiaResumen = {
  slug: string
  nombre: string
  barrio: string
  direccion: string
  colorAcento?: string | null
  logoUrl?: string | null
  precioDesde: number
  /** Próximos horarios libres de hoy, ej. ["15:30", "16:15"]. */
  proximosHorarios?: string[]
  /** Distancia en km desde la ubicación del cliente, si la compartió. */
  distanciaKm?: number
}

type Props = {
  barberia: BarberiaResumen
  href: string
  /** Resaltada (ej. su pin está activo en el mapa). */
  active?: boolean
  className?: string
}

/** Resultado del portal: lleva a la página pública de la barbería. Usa el acento de la barbería. */
export function BarberiaCard({ barberia: b, href, active, className }: Props) {
  return (
    <AccentScope color={b.colorAcento} className={className}>
      <a
        href={href}
        className={cn(
          'focus-ring group block rounded-lg border bg-surface-1 p-5 transition-[border-color,background-color] duration-(--dur-base) ease-out',
          active ? 'border-accent-line' : 'border-line hover:border-line-strong',
        )}
      >
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface-2">
            {b.logoUrl ? (
              <img src={b.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <span aria-hidden className="display text-2xl font-semibold text-accent italic">
                {b.nombre.charAt(0)}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="display truncate text-xl font-medium text-ivory">{b.nombre}</h3>
              <ArrowUpRight
                aria-hidden
                className="size-5 shrink-0 text-subtle transition-[color,translate] duration-(--dur-base) ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
              />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">
                {b.barrio} · {b.direccion}
              </span>
              {b.distanciaKm !== undefined && (
                <span className="tabular shrink-0 text-subtle">
                  · {b.distanciaKm.toLocaleString('es-AR', { maximumFractionDigits: 1 })} km
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
          {b.proximosHorarios && b.proximosHorarios.length > 0 ? (
            <div className="min-w-0">
              <p className="text-xs text-subtle">Libre hoy</p>
              <p className="tabular mt-1 truncate text-[0.9375rem] font-semibold text-accent">
                {b.proximosHorarios.slice(0, 3).join('  ·  ')}
              </p>
            </div>
          ) : (
            <p className="text-sm text-subtle">Sin horarios libres hoy</p>
          )}
          <Price amount={b.precioDesde} from className="shrink-0 text-[0.9375rem] font-semibold text-ivory" />
        </div>
      </a>
    </AccentScope>
  )
}
