import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'accent' | 'outline'
}

const tones = {
  neutral: 'bg-surface-3 text-muted',
  accent: 'bg-accent-soft text-accent',
  outline: 'border border-line-strong text-muted',
}

export function Badge({ tone = 'neutral', className, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5',
        tones[tone],
        className,
      )}
      {...rest}
    />
  )
}
