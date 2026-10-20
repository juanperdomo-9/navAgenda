import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = HTMLAttributes<HTMLDivElement> & {
  /** Resalta la tarjeta al pasar el mouse (para tarjetas clickeables). */
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' }

/** Contenedor base. La elevación se declara una sola vez: borde fino, sin sombra. */
export function Card({ interactive, padding = 'md', className, ...rest }: Props) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface-1',
        paddings[padding],
        interactive &&
          'transition-[border-color,background-color] duration-(--dur-base) ease-out hover:border-line-strong hover:bg-[color-mix(in_oklch,var(--surface-1)_70%,var(--surface-2))]',
        className,
      )}
      {...rest}
    />
  )
}

type HeaderProps = { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }

export function CardHeader({ title, description, action, className }: HeaderProps) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-ivory">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
