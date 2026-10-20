import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { controlClasses, useField } from './Field'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  /** Ícono a la izquierda (lucide). */
  icon?: ReactNode
  /** Elemento a la derecha dentro del control (ej. botón de mostrar contraseña). */
  trailing?: ReactNode
}

export function Input({ icon, trailing, className, id, ...rest }: Props) {
  const field = useField()
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-subtle [&_svg]:size-[18px]">
          {icon}
        </span>
      )}
      <input
        id={id ?? field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(controlClasses, 'h-12 px-4', icon && 'pl-11', trailing && 'pr-12', className)}
        {...rest}
      />
      {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
    </div>
  )
}

export function PasswordInput(props: Omit<Props, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      autoComplete={props.autoComplete ?? 'current-password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="focus-ring tap inline-flex items-center justify-center rounded-sm text-subtle hover:text-ivory [&_svg]:size-[18px]"
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      }
    />
  )
}
