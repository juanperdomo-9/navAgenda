import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Hora visible, ej. "14:30". */
  time: string
  selected?: boolean
}

/** Chip de horario del paso "elegí día y horario". Ocupado = disabled. */
export function TimeSlot({ time, selected, disabled, className, ...rest }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={disabled ? `${time}, ocupado` : undefined}
      disabled={disabled}
      className={cn(
        'focus-ring tabular h-12 rounded-md border text-[0.9375rem] font-semibold transition-[background-color,border-color,color] duration-(--dur-base) ease-out',
        'border-line-strong bg-surface-1 text-ivory hover:border-accent-line hover:bg-surface-2',
        'aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent',
        'disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-subtle disabled:line-through disabled:decoration-1',
        className,
      )}
      {...rest}
    >
      {time}
    </button>
  )
}
