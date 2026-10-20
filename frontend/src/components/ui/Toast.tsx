import * as RToast from '@radix-ui/react-toast'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'success' | 'error' | 'info'
type ToastItem = { id: number; tone: Tone; title: string; description?: string }
type Notify = (t: Omit<ToastItem, 'id'>) => void

const Ctx = createContext<Notify | null>(null)

/** Muestra una notificación: reemplaza a los alerts del navegador. */
export function useToast() {
  const notify = useContext(Ctx)
  if (!notify) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return notify
}

const tones: Record<Tone, { Icon: typeof Info; className: string }> = {
  success: { Icon: CircleCheck, className: 'text-success' },
  error: { Icon: CircleAlert, className: 'text-danger' },
  info: { Icon: Info, className: 'text-info' },
}

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const notify = useCallback<Notify>((t) => setItems((prev) => [...prev, { ...t, id: ++seq }]), [])
  const remove = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id))

  return (
    <Ctx.Provider value={notify}>
      <RToast.Provider swipeDirection="down" duration={5000} label="Notificación">
        {children}
        {items.map(({ id, tone, title, description }) => {
          const { Icon, className } = tones[tone]
          return (
            <RToast.Root
              key={id}
              type={tone === 'error' ? 'foreground' : 'background'}
              onOpenChange={(open) => !open && remove(id)}
              className={cn(
                'pointer-events-auto flex w-full items-start gap-3 rounded-md bg-surface-3 p-4 shadow-3',
                'data-[state=open]:animate-enter data-[state=closed]:opacity-0 data-[swipe=end]:translate-y-(--radix-toast-swipe-end-y)',
                'transition-[opacity,translate] duration-(--dur-base) ease-out data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y) data-[swipe=move]:transition-none',
              )}
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', className)} aria-hidden />
              <div className="min-w-0 flex-1">
                <RToast.Title className="text-[0.9375rem] font-semibold text-ivory">{title}</RToast.Title>
                {description && (
                  <RToast.Description className="mt-0.5 text-sm text-muted">{description}</RToast.Description>
                )}
              </div>
              <RToast.Close
                aria-label="Cerrar"
                className="focus-ring -m-2 grid size-11 shrink-0 place-items-center rounded-sm text-subtle hover:text-ivory"
              >
                <X className="size-4" aria-hidden />
              </RToast.Close>
            </RToast.Root>
          )
        })}
        <RToast.Viewport className="fixed inset-x-0 bottom-0 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none sm:right-0 sm:left-auto sm:mx-0" />
      </RToast.Provider>
    </Ctx.Provider>
  )
}
