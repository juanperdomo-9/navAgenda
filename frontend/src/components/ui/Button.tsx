import { Slot } from '@radix-ui/react-slot'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Ícono a la izquierda (lucide). */
  icon?: ReactNode
  /** Ícono a la derecha. */
  iconRight?: ReactNode
  /** Renderiza el hijo (ej. un <Link>) con los estilos del botón. */
  asChild?: boolean
  fullWidth?: boolean
}

const base =
  'focus-ring relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold ' +
  'rounded-md transition-[background-color,color,border-color,box-shadow,transform] duration-(--dur-base) ease-out ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.15em] [&_svg]:shrink-0'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent shadow-1 hover:bg-accent-hover active:bg-accent-press',
  secondary:
    'border border-line-strong bg-surface-2 text-ivory hover:border-line-input hover:bg-surface-3',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ivory',
  danger: 'bg-danger-strong text-ivory shadow-1 hover:brightness-110',
}

/** Todas las alturas respetan el objetivo táctil mínimo de 44px. */
const sizes: Record<ButtonSize, string> = {
  sm: 'h-11 px-4 text-sm',
  md: 'h-12 px-5 text-[0.9375rem]',
  lg: 'h-14 px-7 text-base tracking-[0.01em]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  asChild,
  fullWidth,
  className,
  children,
  disabled,
  type,
  ...rest
}: Props) {
  const classes = cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)

  if (asChild) {
    return (
      <Slot className={classes} {...rest}>
        {children}
      </Slot>
    )
  }

  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-[1.15em]" label="Procesando" /> : icon}
      <span className={cn(loading && 'opacity-80')}>{children}</span>
      {!loading && iconRight}
    </button>
  )
}
