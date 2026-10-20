import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = HTMLAttributes<HTMLDivElement> & { size?: 'sm' | 'md' | 'lg' }

const sizes = { sm: 'max-w-2xl', md: 'max-w-5xl', lg: 'max-w-7xl' }

/** Ancho máximo centrado con márgenes laterales seguros en mobile. */
export function Container({ size = 'lg', className, ...rest }: Props) {
  return <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', sizes[size], className)} {...rest} />
}
