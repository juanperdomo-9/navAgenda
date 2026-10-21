import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, ApiError } from '@/lib/api'
import { estiloBarberia, fechaLarga, horaAR, pesos } from './comun'
import './barberia.css'

type Ticket = {
  estado: string; inicio: string; fin: string; precio: number; servicio: string; barbero: string; cliente: string
  barberia: { nombre: string; slug: string; color_acento: string; direccion: string | null; barrio: string | null; ciudad: string | null }
  se_puede_cancelar: boolean; cancelar_hasta: string
  fidelidad: { cada: number; descripcion: string; cortes: number; premios: number } | null
}

/** /t/:token — el ticket del turno (link privado): confirmación, cancelar, calendario y tarjeta de cortes. */
export function TicketPage() {
  const { token = '' } = useParams()
  const qc = useQueryClient()
  const t = useQuery({ queryKey: ['ticket', token], queryFn: () => api<Ticket>(`/t/${token}`), retry: false })
  const [confirmando, setConfirmando] = useState(false)
  const [msg, setMsg] = useState('')

  if (t.isPending) return <div className="pb grid place-items-center">Cargando…</div>
  if (t.isError) return <div className="pb tk-pag"><p className="tk-msg" role="alert">{t.error instanceof ApiError && t.error.status === 404 ? 'No encontramos ese turno. Revisá el link.' : t.error.message}</p></div>
  const d = t.data, b = d.barberia
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.direccion ?? ''}, ${b.ciudad ?? 'La Plata'}`)}`
  const f = (x: string) => new Date(x).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const ics = `data:text/calendar;charset=utf-8,${encodeURIComponent(['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `UID:${token}@navagenda`, `DTSTAMP:${f(new Date().toISOString())}`, `DTSTART:${f(d.inicio)}`, `DTEND:${f(d.fin)}`, `SUMMARY:${d.servicio} con ${d.barbero} (${b.nombre})`, `LOCATION:${b.direccion ?? ''}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'))}`

  async function cancelar() {
    try { await api(`/t/${token}/cancelar`, { method: 'POST' }); await qc.invalidateQueries({ queryKey: ['ticket', token] }); setMsg('Listo, cancelamos tu turno.') }
    catch (e) { setMsg(e instanceof ApiError ? e.message : 'No pudimos cancelar. Probá de nuevo.') }
    setConfirmando(false)
  }
  async function compartir() {
    const texto = `Mi turno en ${b.nombre}: ${fechaLarga(d.inicio)} a las ${horaAR(d.inicio)}`
    if (navigator.share) { try { await navigator.share({ title: 'Mi turno', text: texto, url: location.href }); return } catch { /* cancelado */ } }
    try { await navigator.clipboard.writeText(`${texto} ${location.href}`); setMsg('Link copiado. Pegalo en WhatsApp para tenerlo a mano.') } catch { setMsg(location.href) }
  }

  const cortes = d.fidelidad?.cortes ?? 0
  return (
    <div className="pb" style={estiloBarberia(b.color_acento)}>
      <header className="pb-bar"><Link to={`/${b.slug}`}><span className="mark">Nº</span>{b.nombre}</Link></header>
      <main className="tk-pag">
        <article className="tk" aria-label="Tu turno">
          <div className="tk-top"><span>{b.nombre}</span><span>Tu turno</span></div>
          <h1 className="tk-hora">{horaAR(d.inicio)}</h1>
          <p className="tk-dia">{fechaLarga(d.inicio)}</p>
          <span className={`sello ${d.estado === 'cancelado' ? 'cancelado' : ''}`}>{d.estado === 'cancelado' ? 'Cancelado' : d.estado === 'reservado' ? 'Confirmado · sin seña' : d.estado === 'asistio' ? 'Atendido' : 'No asistió'}</span>
          <dl>
            <dt>Con</dt><dd>{d.barbero}</dd>
            <dt>Servicio</dt><dd>{d.servicio}</dd>
            <dt>Precio</dt><dd>{pesos(d.precio)}, en el local</dd>
            <dt>Dónde</dt><dd><a href={mapa} target="_blank" rel="noopener">{b.direccion}</a></dd>
            <dt>A nombre de</dt><dd>{d.cliente}</dd>
          </dl>
          {d.fidelidad && (
            <div className="fid">
              {d.fidelidad.premios > 0 ? `¡Tenés un premio! ${d.fidelidad.descripcion}.` : `Cada corte tacha una tijera. ${d.fidelidad.descripcion}.`}
              <div className="tijeras" role="img" aria-label={`Llevás ${cortes} de ${d.fidelidad.cada} cortes`}>
                {Array.from({ length: d.fidelidad.cada }, (_, i) => <i key={i} className={i < cortes ? 'x' : ''} />)}
              </div>
            </div>
          )}
        </article>
        {msg && <p className="tk-msg" role="status">{msg}</p>}
        <div className="tk-acc">
          {d.estado === 'reservado' && <button type="button" onClick={compartir}>Guardar el ticket en WhatsApp</button>}
          {d.estado === 'reservado' && <a href={ics} download="turno.ics">Agregar al calendario</a>}
          {d.se_puede_cancelar && !confirmando && <button type="button" className="peligro" onClick={() => setConfirmando(true)}>Cancelar turno</button>}
          {confirmando && <><p className="tk-msg">¿Seguro? El horario queda libre para otro.</p><button type="button" className="peligro" onClick={cancelar}>Sí, cancelar</button><button type="button" onClick={() => setConfirmando(false)}>No, lo mantengo</button></>}
          {d.estado === 'reservado' && !d.se_puede_cancelar && <p className="tk-msg">Ya no se puede cancelar desde acá: avisale a la barbería.</p>}
          <Link to={`/${b.slug}`} style={{ border: 0 }}>Sacar otro turno</Link>
        </div>
      </main>
    </div>
  )
}
