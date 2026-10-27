import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'

type Item = {
  id: string; nombre: string; dueno: string | null; activa: boolean; whatsapp: string | null; abono: number | null
  pausa_por_deuda: boolean; pausada_por_deuda: boolean; pago: { pagado_en: string; monto: number | null } | null
  dias_debe: number | null; ultimo_recordatorio: string | null; toca_recordar: boolean
}
type Datos = { mes: string; hoy: string; dia_pausa: number; barberias: Item[] }

const pesos = (n: number) => '$ ' + n.toLocaleString('es-AR')
const ZONA = 'America/Argentina/Buenos_Aires'
const nombreMes = (m: string) => new Date(m + '-15T12:00:00Z').toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })
const mesMas = (m: string, n: number) => { const [a, b] = m.split('-').map(Number); const t = a * 12 + b - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}` }
const cuando = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: ZONA })

/** Mensaje de WhatsApp para recordar el abono (se manda desde el WhatsApp del superadmin). */
function mensaje(b: Item, mes: string, primero: boolean, diaPausa: number) {
  const hola = `Hola${b.dueno ? ` ${b.dueno.split(' ')[0]}` : ''}!`
  const monto = b.abono ? ` (${pesos(b.abono)})` : ''
  if (primero) return `${hola} Te escribo de NavAgenda: ya está el abono de ${nombreMes(mes)} de ${b.nombre}${monto}. Cuando lo pagues avisame y lo marco. ¡Gracias!`
  const aviso = b.pausa_por_deuda ? ` Si el día ${diaPausa} no está pago, la página se pausa hasta que se regularice.` : ''
  return `${hola} Te recuerdo que sigue pendiente el abono de ${nombreMes(mes)} de ${b.nombre}${monto}.${aviso} Cualquier cosa avisame. ¡Gracias!`
}

/** Cobranza del abono: quién pagó, recordatorios de un toque y pausa por deuda. */
export function Cobranza() {
  const qc = useQueryClient()
  const [mes, setMes] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['s-cobranza', mes], queryFn: () => api<Datos>(`/super/cobranza${mes ? `?mes=${mes}` : ''}`) })
  const [editando, setEditando] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const d = q.data
  const actual = d && d.mes === d.hoy.slice(0, 7)
  const refrescar = () => { qc.invalidateQueries({ queryKey: ['s-cobranza'] }); qc.invalidateQueries({ queryKey: ['s-barberias'] }) }
  const err = (e: unknown) => setAviso(e instanceof ApiError ? e.message : 'No se pudo guardar.')

  async function recordar(b: Item) {
    const primero = +d!.hoy.slice(8) === 1 || !b.ultimo_recordatorio
    window.open(`https://wa.me/${b.whatsapp!.replace('+', '')}?text=${encodeURIComponent(mensaje(b, d!.mes, primero, d!.dia_pausa))}`, '_blank', 'noopener')
    try { await api(`/super/cobranza/${b.id}/recordatorio`, { method: 'POST', body: JSON.stringify({ mes: d!.mes }) }); refrescar() } catch (e) { err(e) }
  }
  async function pago(b: Item, pagar: boolean) {
    try {
      if (pagar) await api(`/super/cobranza/${b.id}/pago`, { method: 'POST', body: JSON.stringify({ mes: d!.mes }) })
      else await api(`/super/cobranza/${b.id}/pago?mes=${d!.mes}`, { method: 'DELETE' })
      setAviso(pagar ? `${b.nombre}: pago de ${nombreMes(d!.mes)} anotado.${b.pausada_por_deuda ? ' Volvió a estar online.' : ''}` : `${b.nombre}: pago borrado.`)
      refrescar()
    } catch (e) { err(e) }
  }

  if (!d) return <section className="bloque" style={{ marginTop: 22 }}><h3 className="cond">Cobranza</h3><p className="ayuda" style={{ marginTop: 10 }}>{q.isError ? 'No pudimos traer la cobranza.' : 'Cargando…'}</p></section>
  const deben = d.barberias.filter((b) => !b.pago)
  const tocan = d.barberias.filter((b) => b.toca_recordar)
  const cobrado = d.barberias.reduce((a, b) => a + (b.pago?.monto ?? 0), 0)
  return (
    <section className="bloque cobranza" style={{ marginTop: 22 }}>
      <h3 className="cond">Cobranza de {nombreMes(d.mes)}</h3>
      <div className="nav-periodo">
        <button type="button" className="flecha" onClick={() => setMes(mesMas(d.mes, -1))} aria-label="Mes anterior">‹</button>
        <b>{nombreMes(d.mes)[0].toUpperCase() + nombreMes(d.mes).slice(1)} {d.mes.slice(0, 4)}</b>
        <button type="button" className="flecha" onClick={() => setMes(mesMas(d.mes, 1))} disabled={!!actual} aria-label="Mes siguiente">›</button>
      </div>
      <p className="ayuda" style={{ marginTop: 8 }}>{d.barberias.length - deben.length} de {d.barberias.length} pagaron · cobrado {pesos(cobrado)}</p>
      {actual && tocan.length > 0 && <p className="cobro-hoy">{+d.hoy.slice(8) === 1 ? `Hoy es 1: toca recordarle a todas (${tocan.length}).` : `Hoy toca recordarle a ${tocan.length} ${tocan.length === 1 ? 'barbería que debe' : 'barberías que deben'}.`} Tocá "Recordar por WhatsApp" en cada una.</p>}
      {aviso && <p role="status" className="vacio" style={{ padding: 12, marginTop: 12 }}>{aviso}</p>}
      <ul className="lista">{d.barberias.map((b) => (
        <li key={b.id} className="cliente">
          <span><span className="n cond">{b.nombre}</span>
            <span className="r" style={{ display: 'block' }}>{b.dueno ?? 'Sin admin'}{b.whatsapp ? ` · ${b.whatsapp.replace('+549', '')}` : ' · sin WhatsApp cargado'}{b.abono ? ` · abono ${pesos(b.abono)}` : ''}</span>
            {b.ultimo_recordatorio && !b.pago && <span className="r" style={{ display: 'block' }}>Último recordatorio: {cuando(b.ultimo_recordatorio)}</span>}</span>
          <span className={`sello ${b.pago ? 'completa' : ''}`}>{b.pago ? `Pagó ${cuando(b.pago.pagado_en)}` : b.pausada_por_deuda ? 'Pausada por deuda' : b.dias_debe ? `Debe · ${b.dias_debe} ${b.dias_debe === 1 ? 'día' : 'días'}` : 'Debe'}</span>
          <span className="acc" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center' }}>
            {!b.pago && b.whatsapp && <button type="button" className={b.toca_recordar ? 'btn' : 'link'} onClick={() => recordar(b)}><MessageCircle className="i" aria-hidden />Recordar por WhatsApp</button>}
            {b.pago ? <button type="button" className="link rojo" onClick={() => pago(b, false)}>Deshacer pago</button> : <button type="button" className="link" onClick={() => pago(b, true)}>Marcar pagado</button>}
            <button type="button" className="link" onClick={() => setEditando(editando === b.id ? null : b.id)}>Datos de cobro</button>
          </span>
          {editando === b.id && <DatosCobro b={b} diaPausa={d.dia_pausa} onListo={(m) => { setEditando(null); setAviso(m); refrescar() }} onError={err} />}
        </li>))}</ul>
    </section>
  )
}

function DatosCobro({ b, diaPausa, onListo, onError }: { b: Item; diaPausa: number; onListo: (m: string) => void; onError: (e: unknown) => void }) {
  const [wsp, setWsp] = useState(b.whatsapp?.replace('+549', '') ?? '')
  const [abono, setAbono] = useState(b.abono ? String(b.abono) : '')
  const [pausa, setPausa] = useState(b.pausa_por_deuda)
  async function guardar() {
    try {
      await api(`/super/barberias/${b.id}/cobro`, { method: 'PATCH', body: JSON.stringify({ whatsapp: wsp.trim() || null, abono: abono ? +abono.replace(/\D/g, '') : null, pausa_por_deuda: pausa }) })
      onListo(`Datos de cobro de ${b.nombre} guardados.`)
    } catch (e) { onError(e) }
  }
  return (
    <div className="cobro-ed">
      <label className="campo">WhatsApp del dueño<input type="tel" inputMode="tel" value={wsp} onChange={(e) => setWsp(e.target.value)} placeholder="221 456 7890" /></label>
      <label className="campo">Abono mensual ($)<input inputMode="numeric" value={abono} onChange={(e) => setAbono(e.target.value)} placeholder="15000" /></label>
      <label className="check"><input type="checkbox" checked={pausa} onChange={(e) => setPausa(e.target.checked)} /> Pausar la página si el día {diaPausa} no pagó y ya le recordaste (se reactiva sola al marcar el pago)</label>
      <button type="button" className="btn" onClick={guardar}>Guardar</button>
    </div>
  )
}
