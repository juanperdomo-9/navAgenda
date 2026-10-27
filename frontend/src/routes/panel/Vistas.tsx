import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { Hoja } from './Agenda'
import { Logo } from './Logo'
import { Ubicacion } from './Ubicacion'

type Tramo = { dia_semana: number; desde: string; hasta: string }
type Barbero = { id: string; nombre: string; activo: boolean; horarios: Tramo[]; servicio_ids: string[] }
type Servicio = { id: string; nombre: string; precio: number; duracion_min: number; activo: boolean; barbero_ids: string[] }
type Franja = { desde: string; hasta: string; dias: number[] }

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_L = ['los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados', 'los domingos']
const pesos = (n: number) => '$ ' + n.toLocaleString('es-AR')
const corto = (t: string) => t.slice(0, 5).replace(/^0/, '').replace(':00', '')
const min = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5)
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'No se pudo guardar.')

/** Agrupa tramos iguales en franjas ("10 a 13" los L M X J V). */
function aFranjas(h: Tramo[]): Franja[] {
  const m = new Map<string, Franja>()
  h.forEach((t) => { const k = t.desde.slice(0, 5) + t.hasta.slice(0, 5); const f = m.get(k) ?? { desde: t.desde.slice(0, 5), hasta: t.hasta.slice(0, 5), dias: [] }; f.dias.push(t.dia_semana); m.set(k, f) })
  return [...m.values()].sort((a, b) => min(a.desde) - min(b.desde))
}
export function resumen(h: Tramo[]) {
  const porDia = DIAS.map((_, d) => h.filter((t) => t.dia_semana === d).sort((a, b) => min(a.desde) - min(b.desde)).map((t) => `${corto(t.desde)} a ${corto(t.hasta)}`).join(' y '))
  const g: { d: number; h: number; txt: string }[] = []
  porDia.forEach((txt, d) => { if (!txt) return; const u = g.at(-1); if (u && u.txt === txt && u.h === d - 1) u.h = d; else g.push({ d, h: d, txt }) })
  return g.length ? g.map((x) => `${x.d === x.h ? DIAS_C[x.d] : `${DIAS_C[x.d]} a ${DIAS_C[x.h]}`} ${x.txt}`).join(' · ') : 'Sin horario cargado'
}
function errorFranja(fs: Franja[], i: number) {
  const f = fs[i]
  if (min(f.desde) >= min(f.hasta)) return 'Termina antes de empezar.'
  for (let j = 0; j < fs.length; j++) {
    const g = fs[j], dia = f.dias.find((d) => g.dias.includes(d))
    if (j !== i && dia !== undefined && min(f.desde) < min(g.hasta) && min(g.desde) < min(f.hasta)) return `Se pisa con ${corto(g.desde)} a ${corto(g.hasta)} ${DIAS_L[dia]}.`
  }
  return ''
}

function Hora({ valor, onCambio, label }: { valor: string; onCambio: (v: string) => void; label: string }) {
  const [h, m] = valor.split(':')
  return (
    <span className="hora">
      <select aria-label={`${label}, hora`} value={h} onChange={(e) => onCambio(`${e.target.value}:${m}`)}>{Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, '0')).map((x) => <option key={x}>{x}</option>)}</select>
      <b>:</b>
      <select aria-label={`${label}, minutos`} value={m} onChange={(e) => onCambio(`${h}:${e.target.value}`)}>{Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((x) => <option key={x}>{x}</option>)}</select>
    </span>
  )
}

/* ═══ BARBEROS ═══ */
export function Barberos() {
  const qc = useQueryClient()
  const bs = useQuery({ queryKey: ['p-barberos'], queryFn: () => api<Barbero[]>('/panel/barberos') })
  const ss = useQuery({ queryKey: ['p-servicios'], queryFn: () => api<Servicio[]>('/panel/servicios') })
  const [edit, setEdit] = useState<Barbero | 'nuevo' | null>(null)
  const [aviso, setAviso] = useState('')
  const lista = bs.data ?? []
  const fila = (b: Barbero) => (
    <li key={b.id} className={`fila ${b.activo ? '' : 'baja'}`}>
      <button type="button" onClick={() => setEdit(b)} aria-label={`Editar a ${b.nombre}`}>
        <span className="ini" aria-hidden>{b.nombre.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
        <span><span className="n cond">{b.nombre}</span><span className="r">{resumen(b.horarios)}</span>
          <span className="r">{b.activo ? `${b.servicio_ids.length} ${b.servicio_ids.length === 1 ? 'servicio' : 'servicios'}` : 'No aparece para reservar · su historial queda guardado'}</span></span>
        <span />
      </button>
    </li>
  )
  return (
    <main>
      <div className="titulo"><h1 className="cond">Barberos</h1><button type="button" className="btn" onClick={() => setEdit('nuevo')}><Plus className="i" aria-hidden />Nuevo barbero</button>
        <p>Al sumar un barbero ya aparece en tu página para sacar turno, con su grilla. Solo cargá su horario.</p></div>
      {aviso && <p role="status" className="vacio" style={{ padding: 12 }}>{aviso}</p>}
      {bs.isPending ? <p>Cargando…</p> : lista.some((b) => b.activo) ? <ul className="lista">{lista.filter((b) => b.activo).map(fila)}</ul> : <div className="vacio"><b className="cond">Todavía no hay barberos</b>Sumá el primero y ya se puede sacar turno con él.</div>}
      {lista.some((b) => !b.activo) && <><p className="grupo">Dados de baja</p><ul className="lista">{lista.filter((b) => !b.activo).map(fila)}</ul></>}
      {edit && <EditorBarbero b={edit === 'nuevo' ? null : edit} servicios={(ss.data ?? []).filter((s) => s.activo)} onCerrar={() => setEdit(null)}
        onListo={(t) => { setEdit(null); setAviso(t); qc.invalidateQueries({ queryKey: ['p-barberos'] }); qc.invalidateQueries({ queryKey: ['p-servicios'] }) }} />}
    </main>
  )
}

function EditorBarbero({ b, servicios, onCerrar, onListo }: { b: Barbero | null; servicios: Servicio[]; onCerrar: () => void; onListo: (t: string) => void }) {
  const [nombre, setNombre] = useState(b?.nombre ?? '')
  const [fs, setFs] = useState<Franja[]>(b ? aFranjas(b.horarios) : [{ desde: '12:00', hasta: '18:00', dias: [0, 1, 2, 3, 4] }])
  const [sv, setSv] = useState<string[]>(b ? b.servicio_ids : servicios.map((s) => s.id))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [baja, setBaja] = useState(false)
  const libres = useQuery({ queryKey: ['bloqueos', b?.id], queryFn: () => api<{ id: string; inicio: string; fin: string; motivo: string | null }[]>(`/panel/barberos/${b!.id}/bloqueos`), enabled: !!b })
  const [ld, setLd] = useState(''), [lh, setLh] = useState('')
  const qc = useQueryClient()
  const horarios = fs.flatMap((f) => f.dias.map((d) => ({ dia_semana: d, desde: f.desde, hasta: f.hasta })))
  const cambiar = (i: number, c: Partial<Franja>) => setFs(fs.map((f, j) => (j === i ? { ...f, ...c } : f)))

  async function guardar() {
    if (nombre.trim().length < 2) return setError('Poné el nombre del barbero.')
    if (fs.some((_, i) => errorFranja(fs, i))) return setError('Revisá las franjas marcadas en rojo.')
    if (!horarios.length) return setError('Tocá los días que trabaja en alguna franja.')
    if (!sv.length) return setError('Elegí al menos un servicio.')
    if (guardando) return
    setGuardando(true)
    try {
      let id = b?.id
      if (b) { await api(`/panel/barberos/${b.id}`, { method: 'PATCH', body: JSON.stringify({ nombre }) }); await api(`/panel/barberos/${b.id}/horarios`, { method: 'PUT', body: JSON.stringify({ horarios }) }) }
      else id = (await api<Barbero>('/panel/barberos', { method: 'POST', body: JSON.stringify({ nombre, horarios }) })).id
      await api(`/panel/barberos/${id}/servicios`, { method: 'PUT', body: JSON.stringify({ servicio_ids: sv }) })
      onListo(b ? `Horario de ${nombre.split(' ')[0]} actualizado en tu página.` : `${nombre.split(' ')[0]} ya aparece en tu página para sacar turno.`)
    } catch (e) { setError(errMsg(e)) } finally { setGuardando(false) }
  }
  async function cambiarActivo(activo: boolean) {
    try { await api(`/panel/barberos/${b!.id}`, { method: 'PATCH', body: JSON.stringify({ activo }) }); onListo(activo ? `${b!.nombre.split(' ')[0]} volvió a atender.` : `${b!.nombre.split(' ')[0]} ya no aparece para reservar.`) }
    catch (e) { setError(errMsg(e)) }
  }
  async function agregarLibre() {
    if (!ld) return
    const hasta = lh && lh >= ld ? lh : ld
    const fin = new Date(new Date(hasta + 'T12:00:00').getTime() + 864e5).toISOString().slice(0, 10)
    try { await api(`/panel/barberos/${b!.id}/bloqueos`, { method: 'POST', body: JSON.stringify({ inicio: `${ld}T00:00:00-03:00`, fin: `${fin}T00:00:00-03:00`, motivo: 'Día libre' }) }); setLd(''); setLh(''); qc.invalidateQueries({ queryKey: ['bloqueos', b!.id] }) }
    catch (e) { setError(errMsg(e)) }
  }
  const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })

  return (
    <Hoja titulo={b ? b.nombre : 'Nuevo barbero'} abierta onCerrar={onCerrar}
      pie={<><p className="resumen-h">{resumen(horarios)}</p>{error && <p className="estado mal" role="alert">{error}</p>}
        <div className="botones"><button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button><button type="button" className="btn" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : b ? 'Guardar' : 'Guardar y publicar'}</button></div></>}>
      <section className="bloque"><h3 className="cond">Datos</h3><label className="campo">Nombre y apellido<input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" /></label></section>
      <section className="bloque"><h3 className="cond">Horario</h3><p className="ayuda" style={{ marginTop: 10 }}>Cargá cada franja una vez y tocá los días que la trabaja. Los turnos arrancan cada 30 minutos.</p>
        <div className="franjas">{fs.map((f, i) => { const err = errorFranja(fs, i); return (
          <div key={i} className={`franja ${err ? 'mal' : ''}`}>
            <div className="horas">De <Hora valor={f.desde} label="Desde" onCambio={(v) => cambiar(i, { desde: v })} /> a <Hora valor={f.hasta} label="Hasta" onCambio={(v) => cambiar(i, { hasta: v })} /></div>
            <div className="dias" role="group" aria-label="Días de esta franja">{DIAS.map((d, k) => <button key={k} type="button" aria-pressed={f.dias.includes(k)} aria-label={DIAS_L[k]} onClick={() => cambiar(i, { dias: f.dias.includes(k) ? f.dias.filter((x) => x !== k) : [...f.dias, k].sort() })}>{d}</button>)}</div>
            <div className="pie-f"><p className="err" role="alert">{err}</p><button type="button" className="link rojo" onClick={() => setFs(fs.filter((_, j) => j !== i))}>Quitar franja</button></div>
          </div>) })}</div>
        <button type="button" className="link" onClick={() => setFs([...fs, { desde: '16:00', hasta: '20:00', dias: fs.at(-1)?.dias ?? [] }])}><Plus className="i" aria-hidden />Agregar otra franja</button></section>
      <section className="bloque"><h3 className="cond">Servicios que hace</h3><div className="checks">{servicios.map((s) => (
        <label key={s.id} className="check"><input type="checkbox" checked={sv.includes(s.id)} onChange={() => setSv(sv.includes(s.id) ? sv.filter((x) => x !== s.id) : [...sv, s.id])} />{s.nombre}<small>{s.duracion_min} min · {pesos(s.precio)}</small></label>))}</div></section>
      {b && <section className="bloque"><h3 className="cond">Días libres <small>Vacaciones, trámites, francos</small></h3>
        <ul className="libres">{(libres.data ?? []).length ? libres.data!.map((l) => (
          <li key={l.id}><span>{fecha(l.inicio)}{fecha(new Date(new Date(l.fin).getTime() - 1).toISOString()) !== fecha(l.inicio) ? ` al ${fecha(new Date(new Date(l.fin).getTime() - 1).toISOString())}` : ''}<small>{l.motivo ?? 'Bloqueado'} · no aparece para reservar</small></span>
            <button type="button" className="quitar" aria-label="Quitar" onClick={async () => { await api(`/panel/bloqueos/${l.id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['bloqueos', b.id] }) }}><X className="i" aria-hidden /></button></li>))
          : <li style={{ borderStyle: 'dashed' }}><span>Sin días libres cargados.</span></li>}</ul>
        <div className="fila2" style={{ marginTop: 10 }}><label className="campo" style={{ margin: 0 }}>Desde<input type="date" value={ld} onChange={(e) => setLd(e.target.value)} /></label><label className="campo" style={{ margin: 0 }}>Hasta<input type="date" value={lh} onChange={(e) => setLh(e.target.value)} /></label></div>
        <button type="button" className="btn sec chico" style={{ marginTop: 10 }} onClick={agregarLibre}>Agregar días libres</button></section>}
      {b && (b.activo ? (baja ? <div className="confirmar">¿Dar de baja a {b.nombre.split(' ')[0]}? Deja de aparecer para reservar y su historial queda guardado. Si tiene turnos por atender, avisales.
        <div className="botones"><button type="button" className="btn peligro chico" onClick={() => cambiarActivo(false)}>Dar de baja</button><button type="button" className="btn sec chico" onClick={() => setBaja(false)}>No</button></div></div>
        : <button type="button" className="link rojo" onClick={() => setBaja(true)}>Dar de baja a este barbero</button>)
        : <button type="button" className="link" onClick={() => cambiarActivo(true)}>Volver a darlo de alta</button>)}
    </Hoja>
  )
}

/* ═══ SERVICIOS ═══ */
export function Servicios() {
  const qc = useQueryClient()
  const ss = useQuery({ queryKey: ['p-servicios'], queryFn: () => api<Servicio[]>('/panel/servicios') })
  const bs = useQuery({ queryKey: ['p-barberos'], queryFn: () => api<Barbero[]>('/panel/barberos') })
  const [edit, setEdit] = useState<Servicio | 'nuevo' | null>(null)
  const [aviso, setAviso] = useState('')
  const activos = (bs.data ?? []).filter((b) => b.activo)
  const quien = (s: Servicio) => { const q = activos.filter((b) => s.barbero_ids.includes(b.id)); return q.length === activos.length ? 'Todos los barberos' : q.map((b) => b.nombre.split(' ')[0]).join(', ') || 'Nadie lo hace' }
  const fila = (s: Servicio) => (
    <li key={s.id} className={`fila ${s.activo ? '' : 'baja'}`}><button type="button" onClick={() => setEdit(s)} aria-label={`Editar ${s.nombre}`}>
      <span className="ini" aria-hidden style={{ background: 'var(--papel)', border: '2px solid var(--ink)' }}>{s.duracion_min}'</span>
      <span><span className="n cond">{s.nombre}</span><span className="r">{s.duracion_min} min · {s.activo ? quien(s) : 'De baja: no se ofrece'}</span></span>
      <span className="cond" style={{ fontSize: 26 }}>{pesos(s.precio)}</span></button></li>
  )
  const lista = ss.data ?? []
  return (
    <main>
      <div className="titulo"><h1 className="cond">Servicios</h1><button type="button" className="btn" onClick={() => setEdit('nuevo')}><Plus className="i" aria-hidden />Nuevo servicio</button>
        <p>Precio, duración y quién lo hace. Si cambiás un precio, los turnos ya reservados mantienen el anterior.</p></div>
      {aviso && <p role="status" className="vacio" style={{ padding: 12 }}>{aviso}</p>}
      {ss.isPending ? <p>Cargando…</p> : <ul className="lista">{lista.filter((s) => s.activo).map(fila)}</ul>}
      {lista.some((s) => !s.activo) && <><p className="grupo">Dados de baja</p><ul className="lista">{lista.filter((s) => !s.activo).map(fila)}</ul></>}
      {edit && <EditorServicio s={edit === 'nuevo' ? null : edit} barberos={activos} onCerrar={() => setEdit(null)}
        onListo={(t) => { setEdit(null); setAviso(t); qc.invalidateQueries({ queryKey: ['p-servicios'] }); qc.invalidateQueries({ queryKey: ['p-barberos'] }) }} />}
    </main>
  )
}

function EditorServicio({ s, barberos, onCerrar, onListo }: { s: Servicio | null; barberos: Barbero[]; onCerrar: () => void; onListo: (t: string) => void }) {
  const [nombre, setNombre] = useState(s?.nombre ?? '')
  const [precio, setPrecio] = useState(s ? s.precio.toLocaleString('es-AR') : '')
  const [dur, setDur] = useState(s?.duracion_min ?? 30)
  const [bs, setBs] = useState<string[]>(s ? s.barbero_ids : barberos.map((b) => b.id))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [baja, setBaja] = useState(false)
  async function guardar() {
    const p = +precio.replace(/\D/g, '')
    if (nombre.trim().length < 2) return setError('Poné el nombre del servicio.')
    if (!p) return setError('Poné el precio.')
    if (!bs.length) return setError('Elegí al menos un barbero.')
    if (guardando) return
    setGuardando(true)
    try {
      const datos = { nombre: nombre.trim(), precio: p, duracion_min: dur }
      const out = s ? await api<Servicio>(`/panel/servicios/${s.id}`, { method: 'PATCH', body: JSON.stringify(datos) }) : await api<Servicio>('/panel/servicios', { method: 'POST', body: JSON.stringify(datos) })
      await api(`/panel/servicios/${out.id}/barberos`, { method: 'PUT', body: JSON.stringify({ barbero_ids: bs }) })
      onListo(s ? `"${datos.nombre}" actualizado en tu página.` : `"${datos.nombre}" ya se puede reservar.`)
    } catch (e) { setError(errMsg(e)) } finally { setGuardando(false) }
  }
  async function activo(v: boolean) {
    try { if (v) await api(`/panel/servicios/${s!.id}`, { method: 'PATCH', body: JSON.stringify({ activo: true }) }); else await api(`/panel/servicios/${s!.id}`, { method: 'DELETE' }); onListo(v ? `"${s!.nombre}" se ofrece de nuevo.` : `"${s!.nombre}" ya no se ofrece.`) }
    catch (e) { setError(errMsg(e)) }
  }
  return (
    <Hoja titulo={s ? s.nombre : 'Nuevo servicio'} abierta onCerrar={onCerrar}
      pie={<>{error && <p className="estado mal" role="alert">{error}</p>}<div className="botones"><button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button><button type="button" className="btn" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button></div></>}>
      <section className="bloque"><h3 className="cond">Servicio</h3>
        <label className="campo">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" placeholder="Ej.: Corte + barba" /></label>
        <div className="fila2">
          <label className="campo">Precio<span className="prefijo"><span aria-hidden>$</span><input inputMode="numeric" value={precio} onChange={(e) => { const n = e.target.value.replace(/\D/g, ''); setPrecio(n ? (+n).toLocaleString('es-AR') : '') }} /></span></label>
          <label className="campo">Duración<select value={dur} onChange={(e) => setDur(+e.target.value)}>{Array.from({ length: 48 }, (_, i) => (i + 1) * 5).map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`}</option>)}</select></label>
        </div>
        <p className="ayuda" style={{ marginTop: 8 }}>Los turnos ya reservados mantienen el precio con el que se sacaron.</p></section>
      <section className="bloque"><h3 className="cond">Quién lo hace</h3><div className="checks">{barberos.map((b) => (
        <label key={b.id} className="check"><input type="checkbox" checked={bs.includes(b.id)} onChange={() => setBs(bs.includes(b.id) ? bs.filter((x) => x !== b.id) : [...bs, b.id])} />{b.nombre}<small /></label>))}</div></section>
      {s && (s.activo ? (baja ? <div className="confirmar">¿Dar de baja "{s.nombre}"? Deja de ofrecerse en tu página. Los turnos ya reservados siguen igual.
        <div className="botones"><button type="button" className="btn peligro chico" onClick={() => activo(false)}>Dar de baja</button><button type="button" className="btn sec chico" onClick={() => setBaja(false)}>No</button></div></div>
        : <button type="button" className="link rojo" onClick={() => setBaja(true)}>Dar de baja este servicio</button>)
        : <button type="button" className="link" onClick={() => activo(true)}>Volver a ofrecerlo</button>)}
    </Hoja>
  )
}

/* ═══ MI PÁGINA ═══ */
type Config = { nombre: string; slug: string; logo_url: string | null; color_acento: string; direccion: string | null; barrio: string | null; descripcion: string | null; horas_min_cancelacion: number; lat: string | null; lng: string | null }
type PremioRuleta = { texto: string; descuento_pct: number }
type Regla = { cada_x_cortes: number; tipo: string; valor: number | null; servicio_id: string | null; descripcion: string; modo: 'fijo' | 'ruleta'; ruleta: PremioRuleta[] } | null
const RULETA_INICIAL: PremioRuleta[] = [{ texto: 'Corte gratis', descuento_pct: 100 }, { texto: '50% de descuento', descuento_pct: 50 }, { texto: '20% de descuento', descuento_pct: 20 }, { texto: '10% de descuento', descuento_pct: 10 }]
const PRESETS = ['#c9a46a', '#c47f57', '#d4a24c', '#1f3a5f', '#2f6b4f', '#7a1f2b', '#141210']
function lum(hex: string) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const tinta = (hex: string) => ((lum(hex) + 0.05) / 0.0566 >= 1.03 / (lum(hex) + 0.05) ? '#141210' : '#fffdf3')
const colorOk = (hex: string) => /^#[0-9a-f]{6}$/.test(hex) && Math.max((lum(hex) + 0.05) / 0.0566, 1.03 / (lum(hex) + 0.05)) >= 4.5

export function MiPagina() {
  const qc = useQueryClient()
  const cfg = useQuery({ queryKey: ['p-config'], queryFn: () => api<Config>('/panel/barberia') })
  const regla = useQuery({ queryKey: ['p-regla'], queryFn: () => api<Regla>('/panel/fidelidad') })
  const ss = useQuery({ queryKey: ['p-servicios'], queryFn: () => api<Servicio[]>('/panel/servicios') })
  const bs = useQuery({ queryKey: ['p-barberos'], queryFn: () => api<Barbero[]>('/panel/barberos') })
  const [f, setF] = useState<Config | null>(null)
  const [r, setR] = useState({ cada: 5, tipo: 'servicio_gratis', valor: '', servicio: '', texto: '', modo: 'fijo' as 'fijo' | 'ruleta', ruleta: RULETA_INICIAL })
  const [msg, setMsg] = useState('')
  useEffect(() => { if (cfg.data && !f) setF(cfg.data) }, [cfg.data, f])
  useEffect(() => { if (regla.isSuccess && ss.data) { const x = regla.data; setR({ cada: x?.cada_x_cortes ?? 5, tipo: x?.tipo ?? 'servicio_gratis', valor: x?.valor ? String(x.valor) : '', servicio: x?.servicio_id ?? ss.data.find((s) => s.activo)?.id ?? '', texto: x?.tipo === 'texto' && x.modo !== 'ruleta' ? x.descripcion : '', modo: x?.modo ?? 'fijo', ruleta: x?.ruleta?.length ? x.ruleta : RULETA_INICIAL }) } }, [regla.isSuccess, regla.data, ss.data])
  if (!f) return <main><p>Cargando…</p></main>
  const url = `navagenda.com.ar/${f.slug}`
  const serv = ss.data?.find((s) => s.id === r.servicio)
  const premio = r.tipo === 'servicio_gratis' ? `${serv?.nombre ?? 'Servicio'} gratis` : r.tipo === 'descuento_pct' ? `${r.valor || '?'}% de descuento` : r.tipo === 'descuento_monto' ? `${pesos(+r.valor || 0)} de descuento` : r.texto || 'Premio'
  const ok = colorOk(f.color_acento)
  async function copiar(t: string) { try { await navigator.clipboard.writeText('https://' + t); setMsg('Link copiado.') } catch { setMsg(t) } }
  async function guardar() {
    if (!ok) return setMsg('Con ese color no se lee bien el texto. Probá otro.')
    try {
      await api('/panel/barberia', { method: 'PATCH', body: JSON.stringify({ nombre: f!.nombre, color_acento: f!.color_acento, direccion: f!.direccion, barrio: f!.barrio, descripcion: f!.descripcion, horas_min_cancelacion: f!.horas_min_cancelacion, lat: f!.lat, lng: f!.lng }) })
      const ruleta = r.ruleta.filter((x) => x.texto.trim().length >= 2).map((x) => ({ texto: x.texto.trim(), descuento_pct: Math.max(0, Math.min(100, x.descuento_pct || 0)) }))
      if (r.modo === 'ruleta' && ruleta.length < 2) return setMsg('La ruleta necesita al menos 2 premios con nombre.')
      await api('/panel/fidelidad', { method: 'PUT', body: JSON.stringify(r.modo === 'ruleta'
        ? { cada_x_cortes: r.cada, modo: 'ruleta', ruleta, tipo: 'texto', descripcion: `Cada ${r.cada} cortes, girás la ruleta` }
        : { cada_x_cortes: r.cada, modo: 'fijo', tipo: r.tipo, valor: r.valor ? +r.valor : null, servicio_id: r.tipo === 'servicio_gratis' ? r.servicio : null, descripcion: `Cada ${r.cada} cortes: ${premio}` }) })
      qc.invalidateQueries({ queryKey: ['p-config'] }); qc.invalidateQueries({ queryKey: ['p-regla'] }); setMsg('Tu página se actualizó.')
    } catch (e) { setMsg(errMsg(e)) }
  }
  return (
    <main>
      <div className="titulo"><h1 className="cond">Mi página</h1><p>Lo que ven tus clientes cuando abren tu link. Los cambios se ven al toque.</p></div>
      <div className="dos">
        <div style={{ display: 'grid', gap: 26, alignContent: 'start' }}>
          <section className="bloque"><h3 className="cond">Tu link</h3><p className="ayuda" style={{ marginTop: 10 }}>Ponelo en tu Instagram y tu WhatsApp. Cada barbero tiene el suyo, que abre la página con él ya elegido.</p>
            <ul className="links">{[url, ...(bs.data ?? []).filter((b) => b.activo).map((b) => `${url}?con=${b.nombre.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, '-')}`)].map((l) => (
              <li key={l}><span>{l}</span><button type="button" className="quitar" onClick={() => copiar(l)} aria-label={`Copiar ${l}`}><Copy className="i" aria-hidden /></button></li>))}</ul></section>
          <section className="bloque"><h3 className="cond">Color</h3>
            <div className="colores" role="group" aria-label="Color de tu página">{PRESETS.map((c) => <button key={c} type="button" className="color" style={{ background: c }} aria-pressed={c === f.color_acento} aria-label={`Color ${c}`} onClick={() => setF({ ...f, color_acento: c })} />)}</div>
            <label className="campo">Otro color (hexadecimal)<input value={f.color_acento} maxLength={7} onChange={(e) => setF({ ...f, color_acento: e.target.value.toLowerCase() })} /></label>
            {!ok && <p className="err">Con ese color no se lee bien el texto. Probá uno más claro o más oscuro.</p>}
            {ok && <div className="previa" style={{ ['--prev' as string]: f.color_acento, ['--prev-ink' as string]: tinta(f.color_acento) }}><b className="cond">{f.nombre}</b><span>{f.direccion}</span></div>}</section>
        </div>
        <div style={{ display: 'grid', gap: 26, alignContent: 'start' }}>
          <Logo url={cfg.data?.logo_url ?? null} nombre={f.nombre} onCambio={(m) => { setMsg(m); qc.invalidateQueries({ queryKey: ['p-config'] }) }} />
          <section className="bloque"><h3 className="cond">Datos</h3>
            <label className="campo">Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
            <div className="fila2"><label className="campo">Dirección<input value={f.direccion ?? ''} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></label><label className="campo">Barrio<input value={f.barrio ?? ''} onChange={(e) => setF({ ...f, barrio: e.target.value })} /></label></div>
            <div className="campo">Ubicación en el mapa<span className="ayuda">{f.lat ? 'Listo. Si no es ahí, tocá el lugar correcto.' : 'Tocá el mapa donde está tu local, así aparece en tu página.'}</span>
              <Ubicacion lat={f.lat} lng={f.lng} onCambiar={(lat, lng) => setF((x) => x && { ...x, lat, lng })} /></div>
            <label className="campo">Descripción<textarea maxLength={600} value={f.descripcion ?? ''} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
            <label className="campo">Pueden cancelar hasta<select value={f.horas_min_cancelacion} onChange={(e) => setF({ ...f, horas_min_cancelacion: +e.target.value })}>{[0, 1, 2, 3, 6, 12, 24].map((h) => <option key={h} value={h}>{h ? `${h} h antes` : 'el último momento'}</option>)}</select></label></section>
          <section className="bloque"><h3 className="cond">Tarjeta de cortes</h3><p className="ayuda" style={{ marginTop: 10 }}>Así la ven tus clientes en su ticket: una tijera tachada por cada corte.</p>
            <div className="periodo" role="group" aria-label="Tipo de premio" style={{ marginTop: 12 }}>
              <button type="button" aria-pressed={r.modo === 'fijo'} onClick={() => setR({ ...r, modo: 'fijo' })}>Premio fijo</button>
              <button type="button" aria-pressed={r.modo === 'ruleta'} onClick={() => setR({ ...r, modo: 'ruleta' })}>Ruleta</button>
            </div>
            {r.modo === 'ruleta' ? <>
              <div className="regla">Cada <input type="number" min={1} max={20} value={r.cada} onChange={(e) => setR({ ...r, cada: Math.max(1, Math.min(20, +e.target.value || 1)) })} aria-label="Cantidad de cortes" /> cortes, gira la ruleta.</div>
              <p className="ayuda">Todos los premios tienen la misma chance. El % de descuento es para tus números (100 = gratis, 0 = un regalo sin descuento).</p>
              <ul className="ruleta-ed">{r.ruleta.map((p, i) => (
                <li key={i}>
                  <input value={p.texto} maxLength={60} placeholder="Ej.: Cera de regalo" aria-label={`Premio ${i + 1}`} onChange={(e) => setR({ ...r, ruleta: r.ruleta.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })} />
                  <label><input type="number" min={0} max={100} value={p.descuento_pct} aria-label={`Descuento del premio ${i + 1}`} onChange={(e) => setR({ ...r, ruleta: r.ruleta.map((x, j) => (j === i ? { ...x, descuento_pct: Math.max(0, Math.min(100, +e.target.value || 0)) } : x)) })} />%</label>
                  <button type="button" className="quitar" disabled={r.ruleta.length <= 2} onClick={() => setR({ ...r, ruleta: r.ruleta.filter((_, j) => j !== i) })} aria-label={`Quitar ${p.texto || 'premio'}`}><X className="i" aria-hidden /></button>
                </li>))}</ul>
              {r.ruleta.length < 12 && <button type="button" className="link" onClick={() => setR({ ...r, ruleta: [...r.ruleta, { texto: '', descuento_pct: 0 }] })}><Plus className="i" aria-hidden />Agregar premio</button>}
            </> : <>
            <div className="regla">Cada <input type="number" min={1} max={20} value={r.cada} onChange={(e) => setR({ ...r, cada: Math.max(1, Math.min(20, +e.target.value || 1)) })} aria-label="Cantidad de cortes" /> cortes,
              <select value={r.tipo} onChange={(e) => setR({ ...r, tipo: e.target.value })} aria-label="Tipo de premio"><option value="servicio_gratis">un servicio gratis</option><option value="descuento_pct">un % de descuento</option><option value="descuento_monto">un descuento en $</option><option value="texto">otro premio</option></select>
              {r.tipo === 'servicio_gratis' ? <select value={r.servicio} onChange={(e) => setR({ ...r, servicio: e.target.value })} aria-label="Qué servicio">{(ss.data ?? []).filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
                : r.tipo === 'texto' ? <input style={{ width: 220 }} placeholder="Ej.: una cerveza" value={r.texto} onChange={(e) => setR({ ...r, texto: e.target.value })} />
                : <input type="number" min={1} placeholder={r.tipo === 'descuento_pct' ? '%' : '$'} value={r.valor} onChange={(e) => setR({ ...r, valor: e.target.value })} aria-label="Valor" />}</div>
            </>}
            <div className="tarjeta" role="img" aria-label={`Ejemplo: 2 de ${r.cada} cortes para ${premio}`}>{Array.from({ length: r.cada }, (_, i) => <span key={i} className={`tijera ${i < Math.min(2, r.cada - 1) ? 'x' : ''}`} />)}<span className="premio">{r.modo === 'ruleta' ? 'Ruleta' : premio}</span></div></section>
          {msg && <p role="status" className="vacio" style={{ padding: 12 }}>{msg}</p>}
          <button type="button" className="btn" style={{ justifySelf: 'start' }} onClick={guardar}>Guardar cambios</button>
        </div>
      </div>
    </main>
  )
}
