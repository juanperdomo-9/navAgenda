import * as RTabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Tabs = RTabs.Root
export const TabsContent = RTabs.Content

type ListProps = { label: string; children: ReactNode; className?: string }

/** Lista de pestañas con scroll horizontal en mobile (ej. una pestaña por barbero). */
export function TabsList({ label, children, className }: ListProps) {
  return (
    <RTabs.List
      aria-label={label}
      className={cn(
        '-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0',
        className,
      )}
    >
      {children}
    </RTabs.List>
  )
}

type TabProps = { value: string; children: ReactNode; icon?: ReactNode; disabled?: boolean }

export function Tab({ value, children, icon, disabled }: TabProps) {
  return (
    <RTabs.Trigger
      value={value}
      disabled={disabled}
      className={cn(
        'focus-ring relative inline-flex h-12 shrink-0 items-center gap-2 rounded-t-sm px-4 text-[0.9375rem] font-semibold whitespace-nowrap text-muted',
        'transition-colors duration-(--dur-base) ease-out hover:text-ivory disabled:opacity-45',
        'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent after:opacity-0 after:transition-opacity after:duration-(--dur-base)',
        'data-[state=active]:text-ivory data-[state=active]:after:opacity-100',
      )}
    >
      {icon}
      {children}
    </RTabs.Trigger>
  )
}
