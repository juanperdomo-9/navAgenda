import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, Search } from 'lucide-react'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { MAPA, SEG } from '../publico/Led'

type Cliente = { id: string; nombre: string; telefono: string; bloqueado: boolean; visitas: number; ausencias: number; premios_usados: number; cortes: number; premios: number }
type Numeros = { facturado: number; cortes: number; ausencias: number; premios: number; por_barbero: { id: string; nombre: string; facturado: number; cortes: number }[]; servicios: { nombre: string; veces: number }[]; desde: string; hasta: string; agrupado: 'dia' | 'mes'; por_periodo: { clave: string; facturado: number }[] }

const ZONA = 'America/Argentina/Buenos_Aires'
const pesos = (n: number) => '$ ' + n.toLocaleString('es-AR')
const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s/g, '')
/** +5492214567890 → 221 456 7890 */
const telFmt = (t: string) => { const n = t.replace(/^\+549?/, ''); return n.length === 10 ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : t }

/** Números en 7 segmentos (mismo dibujo que el LED de la página). */
function Seg({ txt }: { txt: string }) {
  return (
    <span className="seg" aria-hidden>
      {[...txt].map((c, i) => c === '.'
        ? <svg key={i} viewBox="0 0 16 124"><circle cx="8" cy="114" r="6" className="on" /></svg>
        : <svg key={i} viewBox="0 0 80 124">{Object.entries(SEG).map(([k, p]) => <path key={k} d={p} className={/\d/.test(c) && MAPA[+c].includes(k) ? 'on' : 'off'} />)}</svg>)}
    </span>
  )
}

export function Clientes() {
  const qc = useQueryClient()
  const cs = useQuery({ queryKey: ['p-clientes'], queryFn: () => api<Cliente[]>('/panel/clientes') })
  const regla = useQuery({ queryKey: ['p-regla'], queryFn: () => api<{ cada_x_cortes: number } | null>('/panel/fidelidad') })
  const [q, setQ] = useState('')
  const [aviso, setAviso] = useState('')
  const cada = regla.data?.cada_x_cortes ?? 0

  async function bloquear(c: Cliente) {
    try {
      await api(`/panel/clientes/${c.id}`, { method: 'PATCH', body: JSON.stringify({ bloqueado: !c.bloqueado }) })
      setAviso(c.bloqueado ? `${c.nombre.split(' ')[0]} puede volver a sacar turnos.` : `${c.nombre.split(' ')[0]} no puede sacar turnos online.`)
      qc.invalidateQueries({ queryKey: ['p-clientes'] })
    } catch (e) { setAviso(e instanceof ApiError ? e.message : 'No se pudo guardar.') }
  }

  const b = sinTildes(q).replace(/^0|^\+?549?/, '')
  const ls = (cs.data ?? []).filter((c) => !b || sinTildes(c.nombre).includes(b) || c.telefono.includes(b.replace(/^15/, '')))
  return (
    <main>
      <div className="titulo"><h1 className="cond">Clientes</h1><p>Se identifican por teléfono. Cada corte al que vienen tacha una tijera de su tarjeta.</p></div>
      <label className="buscar"><Search className="i" aria-hidden /><span className="sr-only">Buscar cliente</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o teléfono" autoComplete="off" /></label>
      {aviso && <p role="status" className="vacio" style={{ padding: 12, marginTop: 14 }}>{aviso}</p>}
      {cs.isPending ? <p style={{ marginTop: 16 }}>Cargando…</p>
        : !cs.data?.length ? <div className="vacio" style={{ marginTop: 16 }}><b className="cond">Todavía no hay clientes</b>Aparecen acá cuando alguien saca su primer turno.</div>
        : !ls.length ? <div className="vacio" style={{ marginTop: 16 }}><b className="cond">Nadie con "{q}"</b>Probá con otro nombre o con el teléfono sin 0 ni 15.</div>
        : <ul className="lista">{ls.map((c) => (
          <li key={c.id} className={`cliente ${c.bloqueado ? 'bloq' : ''}`}>
            <span><span className="n cond">{c.nombre}</span><span className="r" style={{ display: 'block' }}>{telFmt(c.telefono)} · {c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'} · {c.ausencias} {c.ausencias === 1 ? 'ausencia' : 'ausencias'} · {c.premios_usados} {c.premios_usados === 1 ? 'premio usado' : 'premios usados'}</span></span>
            {c.premios > 0 ? <span className="sello"><Gift className="i" aria-hidden />Tiene premio</span>
              : cada > 0 && <span className="tarjetita" role="img" aria-label={`${c.cortes} de ${cada} cortes`}>{Array.from({ length: cada }, (_, i) => <i key={i} className={i < c.cortes ? 'x' : ''} />)}</span>}
            <span className="acc"><button className={`link ${c.bloqueado ? '' : 'rojo'}`} type="button" onClick={() => bloquear(c)}>{c.bloqueado ? 'Desbloquear teléfono' : 'Bloquear teléfono'}</button>{c.bloqueado && <span className="ayuda"> No puede sacar turnos online.</span>}</span>
          </li>))}</ul>}
    </main>
  )
}

const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA })
const sumar = (f: string, d: number) => { const x = new Date(f + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10) }
const finDeMes = (ini: string) => sumar(sumar(ini, 32).slice(0, 8) + '01', -1)
const mesMas = (ini: string, n: number) => { const [a, m] = ini.split('-').map(Number); const t = a * 12 + m - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01` }
type Periodo = 'dia' | 'semana' | 'mes' | 'todo'
/** Rango del período, `off` períodos para atrás (0 = el actual). "todo" = desde el primer turno. */
function rango(p: Periodo, off: number, dia: string): [string | null, string] {
  const h = hoyAR()
  if (p === 'dia') return [dia, dia]
  if (p === 'semana') { const l = sumar(h, -((new Date(h + 'T12:00:00Z').getUTCDay() + 6) % 7) - 7 * off); return [l, sumar(l, 6)] }
  if (p === 'mes') { const ini = mesMas(h.slice(0, 8) + '01', -off); return [ini, finDeMes(ini)] }
  return [null, h]
}
const fecha = (f: string, o: Intl.DateTimeFormatOptions) => new Date(f + 'T12:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC', ...o })
function titulo(p: Periodo, desde: string | null, hasta: string) {
  if (p === 'dia') { const t = hasta === hoyAR() ? 'Hoy · ' : ''; return t + fecha(hasta, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
  if (p === 'semana') return `Semana del ${fecha(desde!, { day: 'numeric', month: 'short' })} al ${fecha(hasta, { day: 'numeric', month: 'short', year: 'numeric' })}`
  if (p === 'mes') { const t = fecha(desde!, { month: 'long', year: 'numeric' }); return t[0].toUpperCase() + t.slice(1) }
  return desde ? `Desde el ${fecha(desde, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Desde el primer turno'
}
const DIA = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const MES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
/** Primer nombre, con la inicial del apellido si se repite ("Agus M."). */
const nombreCorto = (n: string, todos: string[]) => { const [p, a] = n.split(' '); return a && todos.filter((x) => x.split(' ')[0] === p).length > 1 ? `${p} ${a[0]}.` : p }

export function Numeros() {
  const [periodo, setPeriodo] = useState<Periodo>('dia')
  const [off, setOff] = useState(0)
  const [dia, setDia] = useState(hoyAR())
  const [barbero, setBarbero] = useState('')
  const [desde, hasta] = rango(periodo, off, dia)
  const bs = useQuery({ queryKey: ['p-barberos'], queryFn: () => api<{ id: string; nombre: string; activo: boolean }[]>('/panel/barberos') })
  const n = useQuery({
    queryKey: ['p-numeros', desde, hasta, barbero],
    queryFn: () => api<Numeros>(`/panel/numeros?hasta=${hasta}${desde ? `&desde=${desde}` : ''}${barbero ? `&barbero_id=${barbero}` : ''}`),
  })
  const P = n.data
  const tasa = P && P.cortes + P.ausencias ? Math.round((P.ausencias / (P.cortes + P.ausencias)) * 100) : 0
  const maxB = Math.max(1, ...(P?.por_barbero ?? []).map((x) => x.facturado))
  const maxS = Math.max(1, ...(P?.servicios ?? []).map((x) => x.veces))
  const maxD = Math.max(1, ...(P?.por_periodo ?? []).map((x) => x.facturado))
  const quien = barbero ? nombreCorto(bs.data?.find((b) => b.id === barbero)?.nombre ?? '', (bs.data ?? []).map((b) => b.nombre)) : ''
  const actual = periodo === 'dia' ? dia === hoyAR() : off === 0
  const mover = (d: number) => (periodo === 'dia' ? setDia(sumar(dia, -d)) : setOff(Math.max(0, off + d)))
  const etiqueta = (k: string) => P?.agrupado === 'mes' ? MES[+k.slice(5, 7) - 1] : periodo === 'semana' ? DIA[new Date(k + 'T12:00:00Z').getUTCDay()] : (+k.slice(8) % 5 === 1 ? String(+k.slice(8)) : ' ')
  const marca = (k: string) => (P?.agrupado === 'mes' ? k === hoyAR().slice(0, 7) : k === hoyAR())

  return (
    <main>
      <div className="titulo"><h1 className="cond">Números</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div className="periodo" role="group" aria-label="Período">{([['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['todo', 'Todo']] as const).map(([k, t]) => <button key={k} type="button" aria-pressed={k === periodo} onClick={() => { setPeriodo(k); setOff(0) }}>{t}</button>)}</div>
          <label className="campo" style={{ margin: 0 }}><span className="sr-only">Barbero</span>
            <select value={barbero} onChange={(e) => setBarbero(e.target.value)} style={{ minHeight: 44 }}>
              <option value="">Todos los barberos</option>
              {(bs.data ?? []).filter((b) => b.activo).map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select></label>
        </div>
        <div className="nav-periodo">
          {periodo !== 'todo' && <button type="button" className="flecha" onClick={() => mover(1)} aria-label="Período anterior">‹</button>}
          <b aria-live="polite">{titulo(periodo, P?.desde ?? desde, hasta)}</b>
          {periodo !== 'todo' && <button type="button" className="flecha" onClick={() => mover(-1)} disabled={actual} aria-label="Período siguiente">›</button>}
          {periodo === 'dia' && <label><span className="sr-only">Elegir día</span><input type="date" value={dia} max={hoyAR()} onChange={(e) => e.target.value && setDia(e.target.value)} /></label>}
          {!actual && periodo !== 'todo' && <button type="button" className="link" onClick={() => { setOff(0); setDia(hoyAR()) }}>Volver a hoy</button>}
        </div>
        <p>Solo cuenta lo que se cobró: turnos marcados "Asistió" (con el descuento del premio, si lo hubo).</p></div>
      {!P ? <p>{n.isError ? 'No pudimos traer los números.' : 'Cargando…'}</p> : <>
        <div className="facturado" role="img" aria-label={`Facturado: ${pesos(P.facturado)}`}>
          <small>{quien ? `${quien} facturó` : 'Facturado'}</small>
          <div className="monto"><span>$</span><Seg txt={P.facturado.toLocaleString('es-AR')} /></div>
          <p>{P.cortes} {P.cortes === 1 ? 'corte' : 'cortes'} · {tasa}% no vino · ticket promedio {pesos(P.cortes ? Math.round(P.facturado / P.cortes) : 0)}{P.premios ? ` · ${P.premios} ${P.premios === 1 ? 'premio' : 'premios'}` : ''}</p>
        </div>
        {periodo !== 'dia' && P.por_periodo.length > 1 && (
          <section className="bloque" style={{ marginTop: 26 }}><h3 className="cond">{P.agrupado === 'mes' ? 'Mes por mes' : 'Día por día'}</h3>
            <div role="img" aria-label={P.agrupado === 'mes' ? 'Facturado por mes' : 'Facturado por día'} style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, marginTop: 12 }}>
              {P.por_periodo.map((d) => <span key={d.clave} title={`${d.clave}: ${pesos(d.facturado)}`} style={{ flex: 1, display: 'grid', gap: 4, alignContent: 'end', height: '100%', textAlign: 'center', font: '700 11px Archivo' }}>
                <i style={{ display: 'block', height: `${(d.facturado / maxD) * 96}px`, minHeight: 2, background: marca(d.clave) ? 'var(--led)' : 'var(--ink)' }} />
                {etiqueta(d.clave)}
              </span>)}
            </div></section>)}
        <div className="dos" style={{ marginTop: 26 }}>
          {!barbero && <section className="bloque"><h3 className="cond">Por barbero</h3><div className="barras">{P.por_barbero.map((b) => <div key={b.id} className="barra"><span>{nombreCorto(b.nombre, P.por_barbero.map((x) => x.nombre))}</span><span className="t"><i style={{ width: `${(b.facturado / maxB) * 100}%` }} /></span><span className="v">{pesos(b.facturado)}</span></div>)}</div></section>}
          <section className="bloque"><h3 className="cond">Lo que más sale</h3>
            {P.servicios.length ? <div className="barras">{P.servicios.map((s) => <div key={s.nombre} className="barra"><span>{s.nombre}</span><span className="t"><i style={{ width: `${(s.veces / maxS) * 100}%` }} /></span><span className="v">{s.veces} {s.veces === 1 ? 'vez' : 'veces'}</span></div>)}</div>
              : <p className="ayuda" style={{ marginTop: 10 }}>Todavía no hay cortes marcados en este período.</p>}</section>
        </div>
      </>}
    </main>
  )
}
