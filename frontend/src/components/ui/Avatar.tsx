import { useState } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Aro del color de acento (ej. barbero seleccionado). */
  ring?: boolean
  className?: string
}

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-16 text-lg',
  xl: 'size-24 text-2xl',
}

export function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** Foto circular con recorte centrado; si no hay foto o falla, muestra iniciales. */
export function Avatar({ name, src, size = 'md', ring, className }: Props) {
  const [error, setError] = useState(false)
  const mostrarFoto = src && !error

  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-semibold text-muted select-none',
        ring && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas',
        sizes[size],
        className,
      )}
    >
      {mostrarFoto ? (
        <img
          src={src}
          alt={name}
          onError={() => setError(true)}
          className="size-full object-cover object-[50%_30%]"
          loading="lazy"
        />
      ) : (
        <>
          <span aria-hidden className="display font-medium">
            {iniciales(name)}
          </span>
          <span className="sr-only">{name}</span>
        </>
      )}
    </span>
  )
}
