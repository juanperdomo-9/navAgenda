import { createContext, useContext, useId, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

type FieldCtx = { id: string; describedBy?: string; invalid: boolean }
const Ctx = createContext<FieldCtx | null>(null)

/** Lo usan los controles para conectarse solos con su label, ayuda y error. */
export function useField() {
  return useContext(Ctx)
}

type Props = {
  label: string
  hint?: string
  error?: string
  /** Muestra "(opcional)" junto al label. */
  optional?: boolean
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, optional, className, children }: Props) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <Ctx.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn('flex flex-col gap-2', className)}>
        <label htmlFor={id} className="text-sm font-semibold text-ivory">
          {label}
          {optional && <span className="ml-1.5 font-normal text-subtle">(opcional)</span>}
        </label>
        {children}
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : (
          hint && (
            <p id={hintId} className="text-sm text-subtle">
              {hint}
            </p>
          )
        )}
      </div>
    </Ctx.Provider>
  )
}

/** Clases compartidas por Input, Textarea y Select. */
export const controlClasses =
  'w-full rounded-md border border-line-input bg-surface-2 text-base text-ivory placeholder:text-subtle ' +
  'transition-[border-color,box-shadow,background-color] duration-(--dur-base) ease-out ' +
  'hover:border-muted focus-visible:border-accent focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-invalid:border-danger'
