import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

type Props = {
  steps: string[]
  /** Índice del paso actual (0 = primero). */
  current: number
  className?: string
}

/** Progreso del flujo de reserva. En mobile muestra solo el paso actual con su nombre. */
export function Stepper({ steps, current, className }: Props) {
  return (
    <nav aria-label="Pasos de la reserva" className={className}>
      <p className="mb-3 text-sm text-muted sm:hidden">
        Paso <span className="tabular font-semibold text-ivory">{current + 1}</span> de {steps.length}
        <span className="mx-2 text-subtle">·</span>
        <span className="text-ivory">{steps[current]}</span>
      </p>
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li
              key={step}
              aria-current={active ? 'step' : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 last:flex-none sm:last:flex-1"
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular transition-colors duration-(--dur-slow) ease-out',
                  done && 'border-accent bg-accent text-on-accent',
                  active && 'border-accent text-accent',
                  !done && !active && 'border-line-strong text-subtle',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
                <span className="sr-only">{done ? ` ${step}, completado` : ` ${step}`}</span>
              </span>
              <span
                className={cn(
                  'hidden text-sm whitespace-nowrap',
                  active ? 'font-semibold text-ivory sm:block' : 'lg:block',
                  done ? 'text-muted' : !active && 'text-subtle',
                )}
                aria-hidden
              >
                {step}
              </span>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'h-px min-w-4 flex-1 transition-colors duration-(--dur-slow)',
                    done ? 'bg-accent-line' : 'bg-line',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
