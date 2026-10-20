import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = { className?: string; rounded?: 'sm' | 'md' | 'lg' | 'full' }

const radii = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', full: 'rounded-full' }

/** Bloque de carga con un brillo que recorre la superficie (estático con reduced motion). */
export function Skeleton({ className, rounded = 'md' }: Props) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-skeleton bg-[length:250%_100%] motion-reduce:animate-none',
        'bg-[linear-gradient(100deg,var(--surface-2)_30%,var(--surface-3)_50%,var(--surface-2)_70%)]',
        radii[rounded],
        className,
      )}
    />
  )
}

/** Agrupa skeletons y anuncia la carga a lectores de pantalla. */
export function SkeletonGroup({ label = 'Cargando', className, children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
