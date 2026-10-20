import * as RPopover from '@radix-ui/react-popover'
import * as RTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const TooltipProvider = RTooltip.Provider

type TooltipProps = { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }

/** Ayuda breve al pasar el mouse o enfocar. No poner información esencial acá (no existe en touch). */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RTooltip.Root delayDuration={300}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={8}
          className="z-50 max-w-60 rounded-sm bg-surface-3 px-3 py-2 text-sm text-ivory shadow-2 data-[state=delayed-open]:animate-enter"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}

type PopoverProps = {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}

export function Popover({ trigger, children, align = 'start', className }: PopoverProps) {
  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content
          align={align}
          sideOffset={8}
          collisionPadding={16}
          className={cn(
            'z-50 w-72 rounded-md bg-surface-3 p-4 shadow-2 outline-none data-[state=open]:animate-enter',
            className,
          )}
        >
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  )
}
