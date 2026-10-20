import * as RSelect from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { controlClasses, useField } from './Field'

export type SelectOption = { value: string; label: string; disabled?: boolean }

type Props = {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  name?: string
  className?: string
}

export function Select({ options, placeholder = 'Elegí una opción', className, ...rest }: Props) {
  const field = useField()
  return (
    <RSelect.Root {...rest}>
      <RSelect.Trigger
        id={field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(
          controlClasses,
          'flex h-12 items-center justify-between gap-2 px-4 text-left data-placeholder:text-subtle',
          className,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon className="text-subtle">
          <ChevronDown className="size-[18px]" aria-hidden />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-md bg-surface-3 shadow-2 data-[state=open]:animate-enter"
        >
          <RSelect.Viewport className="p-1.5">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex h-11 cursor-pointer select-none items-center rounded-sm pr-3 pl-9 text-[0.9375rem] text-ivory outline-none data-disabled:cursor-not-allowed data-disabled:opacity-45 data-highlighted:bg-surface-2"
              >
                <RSelect.ItemIndicator className="absolute left-3 text-accent">
                  <Check className="size-4" aria-hidden />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}
