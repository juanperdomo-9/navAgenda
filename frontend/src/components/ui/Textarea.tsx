import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { controlClasses, useField } from './Field'

export function Textarea({ className, id, rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useField()
  return (
    <textarea
      id={id ?? field?.id}
      rows={rows}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(controlClasses, 'min-h-24 resize-y px-4 py-3 leading-relaxed', className)}
      {...rest}
    />
  )
}
