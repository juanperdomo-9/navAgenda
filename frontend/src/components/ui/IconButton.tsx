import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Texto accesible obligatorio: el botón no tiene texto visible. */
  label: string
  icon: ReactNode
  variant?: 'ghost' | 'secondary'
}

export function IconButton({ label, icon, variant = 'ghost', className, type, ...rest }: Props) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'focus-ring tap inline-flex items-center justify-center rounded-md transition-colors duration-(--dur-base) ease-out',
        'disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-5',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-ivory',
        variant === 'secondary' &&
          'border border-line-strong bg-surface-2 text-ivory hover:border-line-input hover:bg-surface-3',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
}
