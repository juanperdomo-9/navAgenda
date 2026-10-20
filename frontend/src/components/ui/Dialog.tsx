import * as RDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

type BaseProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Elemento que abre el diálogo (se renderiza con asChild). */
  trigger?: ReactNode
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
}

const overlay =
  'fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-[fade-in_var(--dur-base)_var(--motion-out)]'

function Header({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="pr-10">
      <RDialog.Title className="display text-2xl font-medium text-ivory">{title}</RDialog.Title>
      {description ? (
        <RDialog.Description className="mt-2 text-[0.9375rem] text-muted">{description}</RDialog.Description>
      ) : (
        <RDialog.Description className="sr-only">{title}</RDialog.Description>
      )}
    </div>
  )
}

function CloseButton() {
  return (
    <RDialog.Close
      aria-label="Cerrar"
      className="focus-ring absolute top-3 right-3 grid size-11 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-ivory"
    >
      <X className="size-5" aria-hidden />
    </RDialog.Close>
  )
}

/** Diálogo centrado. Usar solo cuando la tarea necesita interrumpir (confirmaciones, formularios cortos). */
export function Dialog({ open, onOpenChange, trigger, title, description, children, footer }: BaseProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-1 p-6 shadow-3 outline-none data-[state=open]:animate-enter sm:p-8">
          <Header title={title} description={description} />
          <CloseButton />
          {children && <div className="mt-6">{children}</div>}
          {footer && <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/** Panel que sube desde abajo en mobile y se abre a la derecha en pantallas grandes. */
export function Sheet({ open, onOpenChange, trigger, title, description, children, footer }: BaseProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface-1 shadow-3 outline-none',
            'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-lg pb-[env(safe-area-inset-bottom)] data-[state=open]:animate-[sheet-up_var(--dur-slow)_var(--motion-out)]',
            'md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-lg md:data-[state=open]:animate-[sheet-left_var(--dur-slow)_var(--motion-out)]',
          )}
        >
          <div aria-hidden className="mx-auto mt-3 h-1 w-10 rounded-full bg-line-strong md:hidden" />
          <div className="relative px-6 pt-5 md:pt-8">
            <Header title={title} description={description} />
            <CloseButton />
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
          {footer && <div className="flex flex-col gap-3 border-t border-line px-6 py-4">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

type ConfirmProps = {
  trigger: ReactNode
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

/** Confirmación de acciones irreversibles. Reemplaza a window.confirm. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Volver',
  destructive,
  onConfirm,
}: ConfirmProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function confirmar() {
    setLoading(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={confirmar} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
