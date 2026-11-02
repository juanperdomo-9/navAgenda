import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '@/lib/api'
import { Ruleta } from './Ruleta'

/** Lo que ganó en la ruleta de bienvenida (queda en el celular hasta que vence). */
export type Ganado = { premio: string; vence: number; tel: string }
type Giro = { nuevo: true; indice: number; premio: string; vence_en: string } | { nuevo: false; motivo: string }

const clave = (slug: string) => `navagenda-bienvenida-${slug}`
export function leerGanado(slug: string): Ganado | null {
  try { return JSON.parse(localStorage.getItem(clave(slug)) || 'null') } catch { return null }
}
/** Se muestra el talón si el celular nunca reservó acá ni giró esta ruleta. */
export function mostrarTalon(slug: string) {
  try { return !localStorage.getItem('navagenda-yo') && !localStorage.getItem(clave(slug)) } catch { return true }
}

/** Talón arriba de la máquina: "¿Primera vez acá? Girá la ruleta". */
export function TalonBienvenida({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button type="button" className="bv-talon" onClick={onAbrir}>
      <span className="cond">¿Primera vez acá?</span>
      <b>Girá la ruleta y sacá turno con premio <span aria-hidden>→</span></b>
    </button>
  )
}

/** Reemplaza a la máquina mientras dura: número → ¿es nuevo? → ruleta. */
export function Bienvenida({ slug, premios, onGanado, onCerrar }: {
  slug: string; premios: string[]; onGanado: (g: Ganado) => void; onCerrar: () => void
}) {
  const [tel, setTel] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [giro, setGiro] = useState<Giro | null>(null)

  async function revisar(e: FormEvent) {
    e.preventDefault()
    if (tel.replace(/\D/g, '').length < 10) return setError('Con código de área, sin 0 ni 15. Ej.: 221 456 7890.')
    setEnviando(true); setError('')
    try {
      const r = await api<Giro>(`/p/${slug}/bienvenida`, { method: 'POST', body: JSON.stringify({ telefono: tel }) })
      setGiro(r)
      // Un número gira una sola vez: este celular tampoco vuelve a ver el talón
      if (!r.nuevo) try { localStorage.setItem(clave(slug), JSON.stringify({ premio: '', vence: 0, tel })) } catch { /* opcional */ }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos revisar el número. Probá de nuevo.')
    } finally { setEnviando(false) }
  }

  if (giro?.nuevo) {
    const g = giro
    return (
      <div className="bv">
        <p className="bv-tit cond">¡Bienvenido! Girá</p>
        <Ruleta premios={premios} puedeGirar premio={null} girarCon={async () => g}
          nota="Tenés 3 minutos para sacar tu turno con este premio."
          onListo={(premio) => {
            const ganado = { premio, vence: new Date(g.vence_en).getTime(), tel }
            try { localStorage.setItem(clave(slug), JSON.stringify(ganado)) } catch { /* opcional */ }
            setTimeout(() => onGanado(ganado), 1600)
          }} />
      </div>
    )
  }
  return (
    <form className="bv" onSubmit={revisar} noValidate>
      <button type="button" className="bv-cerrar" onClick={onCerrar} aria-label="Volver a sacar turno">×</button>
      <p className="bv-tit cond">Ruleta de bienvenida</p>
      {giro && !giro.nuevo ? <>
        <p className="bv-txt" role="status">{giro.motivo}</p>
        <button type="button" className="take" onClick={onCerrar}>Sacar turno <span aria-hidden>→</span></button>
      </> : <>
        <p className="bv-txt">Si es tu primer turno acá, girás una vez y ganás un premio. Después tenés 3 minutos para sacar el turno.</p>
        <label className="bv-tel">Tu teléfono<span className="ctrl"><span aria-hidden>+54 9</span>
          <input type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} autoComplete="tel-national" autoFocus /></span></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="take" disabled={enviando}>{enviando ? 'Revisando…' : 'Ver si me toca'} <span aria-hidden>→</span></button>
      </>}
    </form>
  )
}

/** Premio arriba de la máquina con la cuenta regresiva. */
export function PremioActivo({ g, onVence }: { g: Ganado; onVence: () => void }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(i) }, [])
  const resta = Math.max(0, Math.round((g.vence - ahora) / 1000))
  useEffect(() => { if (resta === 0) onVence() }, [resta, onVence])
  return (
    <p className="bv-activo">
      <span className="sello">{g.premio}</span>
      <span>Sacá tu turno en <b aria-hidden>{Math.floor(resta / 60)}:{String(resta % 60).padStart(2, '0')}</b><span className="sr-only">{Math.ceil(resta / 60)} minutos</span> para usarlo (turno dentro de 7 días).</span>
    </p>
  )
}
