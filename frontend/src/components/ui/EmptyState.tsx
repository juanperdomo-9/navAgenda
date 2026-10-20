import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

type Props = {
  icon: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/** Estado vacío diseñado: qué pasa y qué se puede hacer. */
export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="grid size-14 place-items-center rounded-full border border-line bg-surface-2 text-accent [&_svg]:size-6">
        {icon}
      </span>
      <h3 className="display mt-5 text-2xl font-medium text-ivory">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-[0.9375rem] text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

type ErrorProps = {
  title?: string
  description?: ReactNode
  onRetry?: () => void
  className?: string
}

/** Error recuperable: nombra el problema y ofrece cómo seguir. */
export function ErrorState({
  title = 'No pudimos cargar esto',
  description = 'Revisá tu conexión y volvé a intentar.',
  onRetry,
  className,
}: ErrorProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="grid size-14 place-items-center rounded-full border border-line bg-surface-2 text-danger">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h3 className="mt-5 text-lg font-semibold text-ivory">{title}</h3>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-6" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
