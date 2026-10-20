import * as RSwitch from '@radix-ui/react-switch'
import { useId } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  label: string
  description?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Switch({ label, description, className, ...rest }: Props) {
  const id = useId()
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-4', className)}>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[0.9375rem] text-ivory">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-subtle">{description}</span>}
      </label>
      <RSwitch.Root
        id={id}
        className="focus-ring relative h-7 w-12 shrink-0 cursor-pointer rounded-full border border-line-input bg-surface-2 transition-colors duration-(--dur-base) ease-out data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
        {...rest}
      >
        <RSwitch.Thumb className="block size-5 translate-x-[3px] rounded-full bg-muted shadow-1 transition-[translate,background-color] duration-(--dur-base) ease-out data-[state=checked]:translate-x-[23px] data-[state=checked]:bg-on-accent" />
      </RSwitch.Root>
    </div>
  )
}
