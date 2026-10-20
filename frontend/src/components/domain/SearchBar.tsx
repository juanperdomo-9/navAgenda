import { CalendarDays, MapPin, Scissors, Search } from 'lucide-react'
import { useId, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export type Busqueda = { zona: string; servicio: string; fecha: string }

type Props = {
  value: Busqueda
  onChange: (value: Busqueda) => void
  onSubmit: (value: Busqueda) => void
  className?: string
}

function Segmento({ icon, label, children, htmlFor }: { icon: ReactNode; label: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-3 rounded-md px-4 py-2.5 transition-colors duration-(--dur-base) focus-within:bg-surface-2 focus-within:shadow-[inset_0_0_0_1px_var(--accent-line)] lg:py-3">
      <span className="shrink-0 text-accent [&_svg]:size-5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block text-xs font-semibold text-subtle">
          {label}
        </label>
        {children}
      </div>
    </div>
  )
}

const inputClass =
  'block w-full bg-transparent text-base text-ivory placeholder:text-muted outline-none [color-scheme:dark]'

/** Buscador del portal: zona, servicio y fecha. En mobile se apila; en desktop es una sola barra. */
export function SearchBar({ value, onChange, onSubmit, className }: Props) {
  const id = useId()
  const set = (k: keyof Busqueda) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit(value)
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className={cn(
        'flex flex-col rounded-lg border border-line-strong bg-surface-1 p-1.5 shadow-2',
        'focus-within:border-accent-line lg:flex-row lg:items-center',
        className,
      )}
    >
      <Segmento icon={<MapPin />} label="Zona o barrio" htmlFor={`${id}-zona`}>
        <input id={`${id}-zona`} value={value.zona} onChange={set('zona')} placeholder="Palermo, Belgrano…" className={inputClass} autoComplete="off" />
      </Segmento>
      <span aria-hidden className="mx-4 h-px bg-line lg:mx-0 lg:h-8 lg:w-px" />
      <Segmento icon={<Scissors />} label="Servicio" htmlFor={`${id}-servicio`}>
        <input id={`${id}-servicio`} value={value.servicio} onChange={set('servicio')} placeholder="Corte, barba…" className={inputClass} autoComplete="off" />
      </Segmento>
      <span aria-hidden className="mx-4 h-px bg-line lg:mx-0 lg:h-8 lg:w-px" />
      <Segmento icon={<CalendarDays />} label="Día" htmlFor={`${id}-fecha`}>
        <input id={`${id}-fecha`} type="date" value={value.fecha} onChange={set('fecha')} className={inputClass} />
      </Segmento>
      <Button type="submit" size="lg" icon={<Search />} className="m-1.5 lg:ml-2">
        Buscar
      </Button>
    </form>
  )
}
