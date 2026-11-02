import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches
// Los colores del turnero: rollo, tinta, papel y LED. Cada gajo con su tinta legible.
const GAJOS = [
  { fondo: '#f6d13a', tinta: '#141210' },
  { fondo: '#141210', tinta: '#f6d13a' },
  { fondo: '#fffdf3', tinta: '#141210' },
  { fondo: '#ff2b1c', tinta: '#141210' },
]
const R = 100

/** "50% de descuento" → ["50%", "de descuento"]; "Cera de regalo" → ["Cera de", "regalo"]. */
function partes(t: string): [string, string, boolean] {
  const m = t.trim().match(/^(\d+\s*%)\s*(.*)$/)
  if (m) return [m[1].replace(/\s/g, ''), m[2].replace(/^de /i, '') || 'off', true]
  const ws = t.trim().split(/\s+/)
  if (ws.length === 1) return [ws[0], '', false]
  let mejor = 1, dif = Infinity
  for (let i = 1; i < ws.length; i++) {
    const d = Math.abs(ws.slice(0, i).join(' ').length - ws.slice(i).join(' ').length)
    if (d < dif) { dif = d; mejor = i }
  }
  return [ws.slice(0, mejor).join(' '), ws.slice(mejor).join(' '), false]
}

/** Ruleta de premios. El azar lo decide el servidor; la rueda solo frena donde salió. */
export function Ruleta({ token, girarCon, premios, puedeGirar, premio, nota, onListo }: {
  token?: string; premios: string[]; puedeGirar: boolean; premio: string | null; onListo: (premio: string) => void
  /** Cómo se gira (por defecto, la ruleta de fidelidad del ticket) */
  girarCon?: () => Promise<{ indice: number; premio: string }>
  /** Texto debajo del premio ganado */
  nota?: string
}) {
  const [giro, setGiro] = useState(0)
  const [girando, setGirando] = useState(false)
  const [salio, setSalio] = useState<string | null>(null)
  const [error, setError] = useState('')
  const n = premios.length
  const paso = 360 / n

  async function girar() {
    setGirando(true); setError('')
    try {
      const r = girarCon ? await girarCon() : await api<{ indice: number; premio: string }>(`/t/${token}/girar`, { method: 'POST' })
      // Frena con el centro del premio que salió bajo la flecha de arriba
      const destino = giro + 360 * 6 + (360 - ((giro % 360) + (r.indice + 0.5) * paso) % 360)
      setGiro(destino)
      setTimeout(() => { setSalio(r.premio); setGirando(false); onListo(r.premio) }, reducido() ? 50 : 4600)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos girar. Probá de nuevo.')
      setGirando(false)
    }
  }

  // Si la cantidad no cierra el ciclo, el último no repite el color del primero
  const color = (i: number) => (i === n - 1 && n % GAJOS.length === 1 ? GAJOS[2] : GAJOS[i % GAJOS.length])
  // Letra según el ancho del gajo: con muchos premios, más chica
  const grande = Math.min(26, Math.max(15, 120 / n + 8)), chica = Math.min(11, Math.max(8, 40 / n + 5))
  const focos = Math.max(16, n * 3)
  const ganado = salio ?? (!puedeGirar ? premio : null)
  return (
    <div className={`ruleta ${girando ? 'girando' : ''}`}>
      <div className="ruleta-rueda">
        <svg className="ruleta-marco" viewBox="-120 -120 240 240" aria-hidden>
          <circle r="117" fill="#120c0b" />
          {Array.from({ length: focos }, (_, i) => {
            const a = (i * 360 / focos - 90) * Math.PI / 180
            return <circle key={i} className={`foco ${i % 2 ? 'b' : 'a'}`} cx={109 * Math.cos(a)} cy={109 * Math.sin(a)} r="3.6" />
          })}
        </svg>
        <svg className="ruleta-gira" viewBox="-120 -120 240 240" role="img" aria-label={`Ruleta con ${n} premios: ${premios.join(', ')}`}
          style={{ transform: `rotate(${giro}deg)`, transition: girando && !reducido() ? 'transform 4.5s cubic-bezier(.15,.75,.1,1)' : 'none' }}>
          {premios.map((p, i) => {
            const a0 = ((i * paso - 90) * Math.PI) / 180, a1 = (((i + 1) * paso - 90) * Math.PI) / 180
            const medio = i * paso + paso / 2 - 90
            const { fondo, tinta } = color(i)
            const [l1, l2, pct] = partes(p)
            // Del lado izquierdo el texto quedaría cabeza abajo: se da vuelta para leerse derecho
            const izq = Math.cos((medio * Math.PI) / 180) < -0.01
            return (
              <g key={i}>
                <path d={`M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${paso > 180 ? 1 : 0} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`} fill={fondo} stroke="#141210" strokeWidth="2.5" />
                {/* Texto a lo largo del radio, pegado al borde: lo que se lee primero es lo que importa */}
                <g transform={`rotate(${izq ? medio + 180 : medio})`} fill={tinta} style={{ fontFamily: 'var(--type-archivo)', fontStretch: '62%', textTransform: 'uppercase' }}>
                  <text x={izq ? 9 - R : R - 9} y={l2 ? -1 : grande * 0.36} textAnchor={izq ? 'start' : 'end'} style={{ fontWeight: 900, fontSize: pct ? grande + 4 : grande * 0.8 }}>{l1.length > 12 ? l1.slice(0, 11) + '…' : l1}</text>
                  {l2 && <text x={izq ? 9 - R : R - 9} y={pct ? chica + 4 : grande * 0.78} textAnchor={izq ? 'start' : 'end'} style={{ fontWeight: 800, fontSize: pct ? chica : grande * 0.8, letterSpacing: pct ? '.06em' : 0 }}>{l2.length > 14 ? l2.slice(0, 13) + '…' : l2}</text>}
                </g>
              </g>
            )
          })}
          <circle r="26" fill="#120c0b" stroke="#f6d13a" strokeWidth="4" />
          <circle r="7" fill="#ff2b1c" />
        </svg>
        <span className="ruleta-flecha" aria-hidden />
      </div>
      <div aria-live="polite" className="ruleta-pie">
        {ganado ? (
          <p className="ruleta-res">
            <small className="cond">Te salió</small>
            <span className="sello">{ganado}</span>
            <small>{nota ?? 'Mostralo en tu próximo turno: el barbero lo aplica al cobrarte.'}</small>
          </p>
        ) : <button type="button" className="ruleta-btn" onClick={girar} disabled={girando}>{girando ? 'Girando…' : 'Girar la ruleta'}</button>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
