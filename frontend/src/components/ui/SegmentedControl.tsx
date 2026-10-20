import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/cn'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Nombre accesible del grupo. */
  label: string
  className?: string
}

/** Selector exclusivo compacto (ej. Día / Semana en la grilla). */
export function SegmentedControl<T extends string>({ options, value, onValueChange, label, className }: Props<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={label}
      className={cn('inline-flex rounded-md border border-line bg-surface-1 p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="focus-ring h-10 min-w-11 rounded-sm px-4 text-sm font-semibold text-muted transition-colors duration-(--dur-base) ease-out hover:text-ivory data-[state=on]:bg-surface-3 data-[state=on]:text-ivory data-[state=on]:shadow-1"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
