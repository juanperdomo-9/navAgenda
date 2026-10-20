import * as RCheckbox from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  label: ReactNode
  description?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  name?: string
  className?: string
}

export function Checkbox({ label, description, onCheckedChange, className, ...rest }: Props) {
  const id = useId()
  return (
    <div className={cn('flex min-h-11 items-start gap-3 py-1', className)}>
      <RCheckbox.Root
        id={id}
        onCheckedChange={(c) => onCheckedChange?.(c === true)}
        aria-describedby={description ? `${id}-d` : undefined}
        className="focus-ring peer mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border border-line-input bg-surface-2 transition-colors duration-(--dur-fast) hover:border-muted data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-45"
        {...rest}
      >
        <RCheckbox.Indicator className="text-on-accent">
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <label htmlFor={id} className="cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-45">
        <span className="block text-[0.9375rem] text-ivory">{label}</span>
        {description && (
          <span id={`${id}-d`} className="mt-0.5 block text-sm text-subtle">
            {description}
          </span>
        )}
      </label>
    </div>
  )
}
