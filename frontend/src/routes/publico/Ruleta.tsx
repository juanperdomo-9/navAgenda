import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const COLORES = ['#141210', '#fffdf3', '#f6d13a', '#fffdf3']

/** Ruleta de premios. El azar lo decide el servidor; la rueda solo frena donde salió. */
export function Ruleta({ token, premios, puedeGirar, premio, onListo }: {
  token: string; premios: string[]; puedeGirar: boolean; premio: string | null; onListo: () => void
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
      const r = await api<{ indice: number; premio: string }>(`/t/${token}/girar`, { method: 'POST' })
      // Frena con el centro del premio que salió bajo la flecha de arriba
      const destino = giro + 360 * 6 + (360 - ((giro % 360) + (r.indice + 0.5) * paso) % 360)
      setGiro(destino)
      setTimeout(() => { setSalio(r.premio); setGirando(false); onListo() }, reducido() ? 50 : 4600)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos girar. Probá de nuevo.')
      setGirando(false)
    }
  }

  const ganado = salio ?? (!puedeGirar ? premio : null)
  return (
    <div className="ruleta">
      <div className="ruleta-rueda">
        <span className="ruleta-flecha" aria-hidden />
        <svg viewBox="-110 -110 220 220" role="img" aria-label={`Ruleta con ${n} premios: ${premios.join(', ')}`}
          style={{ transform: `rotate(${giro}deg)`, transition: girando && !reducido() ? 'transform 4.5s cubic-bezier(.15,.75,.1,1)' : 'none' }}>
          {premios.map((p, i) => {
            const a0 = ((i * paso - 90) * Math.PI) / 180, a1 = (((i + 1) * paso - 90) * Math.PI) / 180
            const medio = i * paso + paso / 2
            const fondo = COLORES[i % COLORES.length]
            const tinta = fondo === '#141210' ? '#fffdf3' : '#141210'
            return (
              <g key={i}>
                <path d={`M0 0 L${100 * Math.cos(a0)} ${100 * Math.sin(a0)} A100 100 0 ${paso > 180 ? 1 : 0} 1 ${100 * Math.cos(a1)} ${100 * Math.sin(a1)} Z`} fill={fondo} stroke="#141210" strokeWidth="2" />
                <text transform={`rotate(${medio}) translate(0 -62) rotate(90)`} fill={tinta} textAnchor="middle" dominantBaseline="middle"
                  style={{ font: '900 11px var(--type-archivo)', fontStretch: '70%', textTransform: 'uppercase' }}>{p.length > 16 ? p.slice(0, 15) + '…' : p}</text>
              </g>
            )
          })}
          <circle r="16" fill="#120c0b" stroke="#f6d13a" strokeWidth="3" />
        </svg>
      </div>
      <div aria-live="polite">
        {ganado ? <p className="ruleta-res"><span className="sello">Te salió: {ganado}</span><small>Mostralo en tu próximo turno: el barbero lo aplica al cobrarte.</small></p>
          : <button type="button" className="ruleta-btn" onClick={girar} disabled={girando}>{girando ? 'Girando…' : 'Girar la ruleta'}</button>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
