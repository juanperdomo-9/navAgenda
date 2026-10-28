import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Ban, ChevronLeft, ChevronRight, Gift, Plus, X } from 'lucide-react'
import { api, ApiError } from '@/lib/api'

const ZONA = 'America/Argentina/Buenos_Aires'
const PASO = 30, FILA = 60
const pesos = (n: number) => '$ ' + n.toLocaleString('es-AR')
const hm = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA })
const minDe = (iso: string) => { const [h, m] = hm(iso).split(':'); return +h * 60 + +m }
const mh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const ymd = (off: number) => new Date(Date.now() + off * 864e5).toLocaleDateString('en-CA', { timeZone: ZONA })
const dowDe = (fecha: string) => (new Date(fecha + 'T12:00:00').getDay() + 6) % 7 // 0 = lunes
const largo = (fecha: string) => { const t = new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', ''); return t[0].toUpperCase() + t.slice(1) }
const isoAR = (fecha: string, m: number) => `${fecha}T${mh(m)}:00-03:00`

type Barbero = { id: string; nombre: string; activo: boolean; horarios: { dia_semana: number; desde: string; hasta: string }[]; servicio_ids: string[] }
type Servicio = { id: string; nombre: string; precio: number; duracion_min: number; activo: boolean }
type Turno = { id: string; barbero_id: string; inicio: string; fin: string; precio: number; estado: string; beneficio_aplicado: boolean; servicio: string; cliente: { nombre: string; telefono: string }; tiene_premio: boolean; premio: string | null; cobrado: number; completa_tarjeta: boolean; cortes: number }
type Agenda = { cada_x_cortes: number | null; premio: string | null; turnos: Turno[]; bloqueos: { id: string; barbero_id: string; inicio: string; fin: string; motivo: string | null }[] }

/** Hoja (panel lateral) reutilizable. */
export function Hoja({ titulo, abierta, onCerrar, children, pie }: { titulo: string; abierta: boolean; onCerrar: () => void; children: ReactNode; pie: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (abierta) ref.current?.showModal(); else ref.current?.close() }, [abierta])
  return (
    <dialog ref={ref} className="hoja" onClose={onCerrar} aria-label={titulo}>
      <div className="h-cab"><h2 className="cond">{titulo}</h2><button type="button" onClick={onCerrar} aria-label="Cerrar"><X className="i" aria-hidden /></button></div>
      <div className="h-cuerpo">{children}</div>
      <div className="h-pie">{pie}</div>
    </dialog>
  )
}

export function Agenda() {
  const qc = useQueryClient()
  const [off, setOff] = useState(0)
  const fecha = ymd(off)
  const barberos = useQuery({ queryKey: ['p-barberos'], queryFn: () => api<Barbero[]>('/panel/barberos') })
  const servicios = useQuery({ queryKey: ['p-servicios'], queryFn: () => api<Servicio[]>('/panel/servicios') })
  const agenda = useQuery({ queryKey: ['agenda', fecha], queryFn: () => api<Agenda>(`/panel/agenda?fecha=${fecha}`), refetchInterval: 60_000 })
  const [turno, setTurno] = useState<Turno | null>(null)
  const [nuevo, setNuevo] = useState<{ b: Barbero; m: number; pasado?: boolean; bloquear?: boolean } | null>(null)
  const [aviso, setAviso] = useState('')
  const refrescar = () => qc.invalidateQueries({ queryKey: ['agenda'] })

  async function accion(ruta: string, cuerpo?: object, txt?: string) {
    try { await api(ruta, { method: 'POST', body: cuerpo ? JSON.stringify(cuerpo) : undefined }); setTurno(null); refrescar(); if (txt) setAviso(txt) }
    catch (e) { setAviso(e instanceof ApiError ? e.message : 'No se pudo guardar.') }
  }

  const bs = (barberos.data ?? []).filter((b) => b.activo)
  const ag = agenda.data
  const dow = dowDe(fecha)
  const tramos = (b: Barbero) => b.horarios.filter((h) => h.dia_semana === dow).map((h) => [+h.desde.slice(0, 2) * 60 + +h.desde.slice(3, 5), +h.hasta.slice(0, 2) * 60 + +h.hasta.slice(3, 5)])
  const todos = bs.flatMap(tramos)
  const ahora = off === 0 ? minDe(new Date().toISOString()) : off < 0 ? 24 * 60 : 0
  const primerLibre = (b: Barbero) => {
    const t = tramos(b)[0]
    return t ? Math.max(t[0], Math.ceil(ahora / PASO) * PASO) : Math.ceil(Math.max(ahora, 9 * 60) / PASO) * PASO
  }
  const hechos = ag?.turnos.filter((t) => t.estado === 'asistio') ?? []

  let grilla: ReactNode = <div className="vacio"><b className="cond">Cerrado</b>Nadie trabaja este día.</div>
  if (todos.length && ag) {
    const ini = Math.floor(Math.min(...todos.map((t) => t[0])) / 60) * 60, fin = Math.ceil(Math.max(...todos.map((t) => t[1])) / 60) * 60
    const filas = (fin - ini) / PASO, y = (m: number) => ((m - ini) / PASO) * FILA
    const horas = Array.from({ length: filas }, (_, k) => ini + k * PASO)
    grilla = (
      <div className="agenda" role="region" aria-label="Grilla del día" tabIndex={0} style={{ ['--cols' as string]: bs.length }}>
        <div className="ag-cab"><span />{bs.map((b) => <span key={b.id} className="cond">{b.nombre.split(' ').slice(0, 2).join(' ')}</span>)}</div>
        <div className="ag-cuerpo">
          <div className="ag-horas" style={{ height: filas * FILA }}>{horas.map((h) => <span key={h} style={{ top: y(h) }} className={h % 60 ? 'media' : ''}>{mh(h)}</span>)}</div>
          {bs.map((b) => {
            const tr = tramos(b)
            const ts = ag.turnos.filter((t) => t.barbero_id === b.id), bl = ag.bloqueos.filter((x) => x.barbero_id === b.id)
            const ocup = [...ts.map((t) => [minDe(t.inicio), minDe(t.fin)]), ...bl.map((x) => [Math.max(0, minDe(x.inicio)), Math.min(24 * 60, minDe(x.fin) || 24 * 60)])]
            return (
              <div key={b.id} className="col-b" style={{ height: filas * FILA }}>
                {horas.map((h) => {
                  if (!tr.some(([a, z]) => h >= a && h + PASO <= z)) return <div key={h} className="celda fuera" style={{ top: y(h) }} aria-hidden />
                  if (ocup.some(([a, z]) => h < z && a < h + PASO)) return null
                  const pasada = h + PASO <= ahora
                  return <button key={h} type="button" className={`celda libre ${pasada ? 'pasada' : ''}`} style={{ top: y(h) }} onClick={() => setNuevo({ b, m: h, pasado: pasada })} aria-label={`${pasada ? 'Ya pasó' : 'Libre'} ${mh(h)} con ${b.nombre}: cargar turno`}><span>{mh(h)}</span><Plus className="i" aria-hidden /></button>
                })}
                {bl.map((x) => {
                  const a = Math.max(ini, minDe(x.inicio)), z = Math.min(fin, minDe(x.fin) || 24 * 60)
                  return <button key={x.id} type="button" className="bloque-b" style={{ top: y(a), height: y(z) - y(a) }} onClick={async () => { await api(`/panel/bloqueos/${x.id}`, { method: 'DELETE' }); refrescar(); setAviso('Horario desbloqueado.') }} aria-label={`Bloqueado: ${x.motivo ?? ''}. Desbloquear`}><span>{x.motivo || 'Bloqueado'}</span></button>
                })}
                {ts.map((t) => {
                  const clase = t.estado === 'reservado' && t.tiene_premio ? 'con-premio' : t.estado
                  const alto = y(minDe(t.fin)) - y(minDe(t.inicio))
                  return (
                    <button key={t.id} type="button" className={`bloque-t ${clase} ${alto < 50 ? 'corto' : ''}`} style={{ top: y(minDe(t.inicio)) + 2, height: alto - 4 }} onClick={() => setTurno(t)}
                      aria-label={`${hm(t.inicio)} ${t.cliente.nombre}, ${t.servicio}, ${t.estado === 'reservado' ? (t.tiene_premio ? 'tiene premio' : 'reservado') : t.estado === 'asistio' ? 'vino' : 'no vino'}`}>
                      <b>{hm(t.inicio)} {t.cliente.nombre}</b>
                      <span>{t.estado !== 'reservado' && <em>{t.estado === 'asistio' ? (t.beneficio_aplicado ? 'Premio' : 'Vino') : 'No vino'}</em>}{t.servicio}{t.estado === 'reservado' && t.tiene_premio && <Gift className="i" aria-hidden />}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
          {off === 0 && ahora > ini && ahora < fin && <div className="ahora" style={{ top: y(ahora) }}><span>{mh(ahora)}</span></div>}
        </div>
      </div>
    )
  }

  const lunes = off - dowDe(ymd(off))
  return (
    <main>
      <div className="titulo">
        <h1 className="cond">{off === 0 ? 'Hoy' : off === 1 ? 'Mañana' : off === -1 ? 'Ayer' : new Date(fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace(/[.,]/g, '')}</h1>
        <div className="navdia">
          <button type="button" className="icono" onClick={() => setOff(off - 1)} aria-label="Día anterior"><ChevronLeft className="i" aria-hidden /></button>
          <button type="button" className="btn sec chico" disabled={off === 0} onClick={() => setOff(0)}>Hoy</button>
          <button type="button" className="icono" onClick={() => setOff(off + 1)} aria-label="Día siguiente"><ChevronRight className="i" aria-hidden /></button>
          {off >= 0 && bs.length > 0 && <button type="button" className="btn sec chico" onClick={() => setNuevo({ b: bs[0], m: primerLibre(bs[0]), bloquear: true })}><Ban className="i" aria-hidden />Bloquear</button>}
        </div>
        <p>{largo(fecha)} · Tocá un turno para marcar si vino: suma a la caja y a su tarjeta de cortes.</p>
      </div>
      <div className="semana-tira" role="group" aria-label="Semana">
        {Array.from({ length: 7 }, (_, k) => lunes + k).map((o) => {
          const f = ymd(o)
          return <button key={o} type="button" aria-pressed={o === off} onClick={() => setOff(o)}><small>{new Date(f + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}</small><b>{f.slice(8)}</b>{o === 0 && <i>hoy</i>}</button>
        })}
      </div>
      <div className="tablero">
        <div className="dato"><small>Facturado</small><b>{pesos(hechos.reduce((a, t) => a + (t.beneficio_aplicado ? 0 : t.precio), 0))}</b></div>
        <div className="dato"><small>Cortes</small><b>{hechos.length}</b></div>
        <div className="dato"><small>{off < 0 ? 'Sin marcar' : 'Faltan'}</small><b>{ag?.turnos.filter((t) => t.estado === 'reservado').length ?? 0}</b></div>
        <div className="dato"><small>No vinieron</small><b>{ag?.turnos.filter((t) => t.estado === 'no_asistio').length ?? 0}</b></div>
      </div>
      {aviso && <p role="status" className="vacio" style={{ padding: 12 }}>{aviso} <button type="button" className="link" onClick={() => setAviso('')}>Cerrar</button></p>}
      {agenda.isPending || barberos.isPending ? <p>Cargando…</p> : grilla}

      <Hoja titulo={turno ? `${hm(turno.inicio)} · ${turno.cliente.nombre}` : ''} abierta={!!turno} onCerrar={() => setTurno(null)}
        pie={turno && <div className="botones">{turno.estado === 'reservado' ? <>
          <button type="button" className="btn sec" onClick={() => accion(`/panel/turnos/${turno.id}/no-asistio`, undefined, 'Marcado: no vino.')}>No vino</button>
          {turno.tiene_premio && <button type="button" className="btn sec" onClick={() => accion(`/panel/turnos/${turno.id}/asistio`, { aplicar_premio: false }, 'Vino. Premio guardado para la próxima.')}>Vino, sin premio</button>}
          <button type="button" className="btn" onClick={() => accion(`/panel/turnos/${turno.id}/asistio`, { aplicar_premio: turno.tiene_premio }, turno.tiene_premio ? 'Vino y usó su premio.' : turno.completa_tarjeta ? '¡Completó la tarjeta! La próxima tiene premio.' : 'Vino. Tachamos una tijera.')}>{turno.tiene_premio ? 'Vino y aplicar premio' : 'Asistió'}</button>
        </> : <button type="button" className="btn sec" onClick={() => accion(`/panel/turnos/${turno.id}/corregir`, undefined, 'Volvió a reservado.')}>Corregir: volver a reservado</button>}</div>}>
        {turno && <section className="bloque">
          <h3 className="cond">{turno.servicio}</h3>
          <p style={{ marginTop: 12, font: '600 17px/1.5 var(--type-archivo)' }}>{hm(turno.inicio)} a {hm(turno.fin)} · {turno.beneficio_aplicado ? `${pesos(turno.cobrado)} (con premio)` : pesos(turno.precio)}<br />{turno.cliente.telefono.replace('+549', '')}</p>
          {turno.estado === 'reservado' && turno.tiene_premio && <span className="sello" style={{ marginTop: 14 }}>Tiene premio: {turno.premio ?? ag?.premio}</span>}
          {turno.estado === 'reservado' && turno.completa_tarjeta && <span className="sello completa" style={{ marginTop: 14 }}>Con este corte completa la tarjeta</span>}
          {ag?.cada_x_cortes && <div className="tarjetita" style={{ marginTop: 14 }} role="img" aria-label={`${turno.cortes} de ${ag.cada_x_cortes} cortes`}>{Array.from({ length: ag.cada_x_cortes }, (_, i) => <i key={i} className={i < turno.cortes ? 'x' : ''} />)}</div>}
        </section>}
      </Hoja>

      {nuevo && <TurnoAMano key={nuevo.b.id + nuevo.m} b={nuevo.b} m={nuevo.m} pasado={!!nuevo.pasado} barberos={nuevo.bloquear ? bs : undefined} fecha={fecha} servicios={(servicios.data ?? []).filter((s) => s.activo)}
        onListo={(t) => { setNuevo(null); refrescar(); setAviso(t) }} onCerrar={() => setNuevo(null)} />}
    </main>
  )
}

function TurnoAMano({ b: b0, m: m0, pasado, barberos, fecha, servicios: todos, onListo, onCerrar }: { b: Barbero; m: number; pasado: boolean; barberos?: Barbero[]; fecha: string; servicios: Servicio[]; onListo: (t: string) => void; onCerrar: () => void }) {
  const [b, setB] = useState(b0)
  const [m, setM] = useState(m0)
  const [vino, setVino] = useState(true)
  const servicios = todos.filter((s) => b.servicio_ids.includes(s.id))
  const [serv, setServ] = useState(servicios[0]?.id ?? '')
  const [nombre, setNombre] = useState('')
  const [tel, setTel] = useState('')
  const [error, setError] = useState('')
  const [modo, setModo] = useState<'turno' | 'bloqueo'>(barberos ? 'bloqueo' : 'turno')
  const [hasta, setHasta] = useState(m + PASO)
  const [motivo, setMotivo] = useState('')
  async function cargar() {
    if (nombre.trim().length < 2 || tel.replace(/\D/g, '').length < 10) return setError('Poné el nombre y el teléfono con código de área.')
    try {
      const t = await api<Turno>('/panel/turnos', { method: 'POST', body: JSON.stringify({ barbero_id: b.id, servicio_id: serv, inicio: isoAR(fecha, m), nombre, telefono: tel }) })
      if (pasado && vino) {
        await api(`/panel/turnos/${t.id}/asistio`, { method: 'POST', body: JSON.stringify({ aplicar_premio: false }) })
        return onListo(`Cargado: ${mh(m)} ${nombre} vino. Suma a la caja y a su tarjeta.`)
      }
      onListo(`Turno cargado: ${mh(m)} ${nombre} con ${b.nombre.split(' ')[0]}.`)
    }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo cargar.') }
  }
  async function bloquear() {
    try { await api(`/panel/barberos/${b.id}/bloqueos`, { method: 'POST', body: JSON.stringify({ inicio: isoAR(fecha, m), fin: isoAR(fecha, hasta), motivo: motivo.trim() || 'Bloqueado' }) }); onListo(`Bloqueado de ${mh(m)} a ${mh(hasta)} para ${b.nombre.split(' ')[0]}.`) }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo bloquear.') }
  }
  return (
    <Hoja titulo={modo === 'turno' ? (pasado ? 'Turno que ya pasó' : 'Turno a mano') : 'Bloquear horario'} abierta onCerrar={onCerrar} pie={<div className="botones">{modo === 'turno' ? <button type="button" className="btn" onClick={cargar}>{pasado && vino ? 'Cargar: ya vino' : 'Cargar turno'}</button> : <button type="button" className="btn" onClick={bloquear}>Bloquear de {mh(m)} a {mh(hasta)}</button>}</div>}>
      <section className="bloque">
        <h3 className="cond">{mh(m)} con {b.nombre.split(' ')[0]}</h3>
        {barberos ? <>
          <label className="campo">Barbero<select value={b.id} onChange={(e) => setB(barberos.find((x) => x.id === e.target.value)!)}>{barberos.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
          <label className="campo">Desde<select value={m} onChange={(e) => { const v = +e.target.value; setM(v); if (hasta <= v) setHasta(v + PASO) }}>{Array.from({ length: 48 }, (_, i) => i * PASO).map((h) => <option key={h} value={h}>{mh(h)}</option>)}</select></label>
        </> : !pasado && <div className="periodo" role="group" aria-label="Qué hacer" style={{ marginTop: 12 }}>
          <button type="button" aria-pressed={modo === 'turno'} onClick={() => setModo('turno')}>Cargar turno</button>
          <button type="button" aria-pressed={modo === 'bloqueo'} onClick={() => setModo('bloqueo')}>Bloquear horario</button>
        </div>}
        {modo === 'bloqueo' ? <>
          <label className="campo">Hasta<select value={hasta} onChange={(e) => setHasta(+e.target.value)}>{Array.from({ length: Math.floor((24 * 60 - m) / PASO) }, (_, i) => m + PASO * (i + 1)).map((h) => <option key={h} value={h}>{mh(h % (24 * 60))}{h - m >= 60 ? ` (${(h - m) / 60} h)` : ' (30 min)'}</option>)}</select></label>
          <label className="campo">Motivo (opcional)<input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Almuerzo, trámite, curso…" maxLength={120} autoComplete="off" /></label>
          <p className="ayuda" style={{ marginTop: 8 }}>En ese rato nadie puede sacar turno con {b.nombre.split(' ')[0]}. Para desbloquear, tocá el bloque en la grilla.</p>
          {error && <p className="err" role="alert" style={{ marginTop: 10 }}>{error}</p>}
        </> : <>
        <label className="campo">Servicio<select value={serv} onChange={(e) => setServ(e.target.value)}>{servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {pesos(s.precio)}</option>)}</select></label>
        <label className="campo">Nombre del cliente<input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" /></label>
        <label className="campo">Teléfono<span className="prefijo"><span aria-hidden>+54 9</span><input type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} autoComplete="off" /></span><span className="ayuda">Con código de área, sin 0 ni 15. Así suma a su tarjeta.</span></label>
        {pasado && <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={vino} onChange={(e) => setVino(e.target.checked)} />Ya vino<small>Suma a la caja y una tijera a su tarjeta</small></label>}
        {error && <p className="err" role="alert" style={{ marginTop: 10 }}>{error}</p>}
        </>}
      </section>
    </Hoja>
  )
}
