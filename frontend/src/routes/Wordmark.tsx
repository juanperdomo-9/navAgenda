import { Link } from 'react-router'
import { cn } from '@/lib/cn'

/** Logotipo de la plataforma: monograma + nombre en la serif display. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('focus-ring -m-2 inline-flex items-center gap-2.5 rounded-md p-2', className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="var(--surface-1)" stroke="var(--border)" />
        <path
          d="M10 23V9l12 14V9"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="display text-[1.375rem] font-semibold tracking-[-0.01em] text-ivory">
        Nav<span className="font-normal italic">Agenda</span>
      </span>
    </Link>
  )
}
