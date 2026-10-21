import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, ApiError } from '@/lib/api'
import { NotFoundPage } from '@/routes/NotFoundPage'
import { estiloBarberia, guardarTicket, horaAR, hoyMas, pesos } from './comun'
import { Led } from './Led'
import { diaDe, Secciones, type Libre, type PaginaBarberia } from './Secciones'
import './barberia.css'

type Pagina = PaginaBarberia & { color_acento: string }

const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const iniciales = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

/** navagenda.com.ar/:slug — la página que comparte cada barbería. Diseño: design/barberia. */
export function BarberiaPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const pag = useQuery({ queryKey: ['pagina', slug], queryFn: () => api<Pagina>(`/p/${slug}`), retry: false })
  if (pag.isPending) return <div className="pb grid place-items-center" aria-busy>Cargando…</div>
  if (pag.error instanceof ApiError && pag.error.status === 404) return <NotFoundPage />
  if (pag.isError) return <div className="pb p-6" role="alert">{pag.error.message}</div>
  return <Maquina p={pag.data} con={params.get('con')} />
}

function Maquina({ p, con }: { p: Pagina; con: string | null }) {
  const navigate = useNavigate()
  // ?con=agus-martin (nombre completo) o ?con=thiago (nombre de pila)
  const inicial = con ? p.barberos.find((b) => sinTildes(b.nombre).replace(/\s+/g, '-') === sinTildes(con)) ?? p.barberos.find((b) => sinTildes(b.nombre.split(' ')[0]) === sinTildes(con)) : undefined
  const [barbero, setBarbero] = useState<string | null>(inicial?.id ?? null)
  const servicios = p.servicios.filter((s) => !barbero || p.barberos.find((b) => b.id === barbero)?.servicio_ids.includes(s.id))
  const [servicio, setServicio] = useState(servicios[0]?.id ?? '')
  const [dia, setDia] = useState(0)
  const [fecha, setFecha] = useState('')
  const ymd = fecha || hoyMas(dia)
  const diaTxt = fecha ? new Date(fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace(',', '') : dia === 0 ? 'hoy' : 'mañana'

  useEffect(() => { if (servicios.length && !servicios.some((s) => s.id === servicio)) setServicio(servicios[0].id) }, [barbero]) // eslint-disable-line react-hooks/exhaustive-deps

  const libres = useQuery({
    queryKey: ['libres', p.slug, servicio, ymd, barbero],
    queryFn: () => api<Libre[]>(`/p/${p.slug}/libres?servicio_id=${servicio}&fecha=${ymd}${barbero ? `&barbero_id=${barbero}` : ''}`),
    enabled: !!servicio,
  })
  const lista = libres.data ?? []
  const prox = lista[0]
  // Nombre corto; si dos barberos se llaman igual, con la inicial del apellido ("Agus M.")
  const nombreDe = (id: string) => {
    const [n, ap] = (p.barberos.find((b) => b.id === id)?.nombre ?? '').split(' ')
    return p.barberos.filter((b) => b.nombre.split(' ')[0] === n).length > 1 && ap ? `${n} ${ap[0]}.` : n
  }
  const serv = p.servicios.find((s) => s.id === servicio)

  const [elegido, setElegido] = useState<Libre | null>(null)
  const hoja = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (elegido) hoja.current?.showModal(); else hoja.current?.close() }, [elegido])

  const maq = useRef<HTMLElement>(null)
  const subir = () => maq.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  // Desde la lista de precios: si el barbero elegido no hace ese servicio, pasa a "cualquiera"
  const elegirServicio = (id: string) => { if (barbero && !p.barberos.find((b) => b.id === barbero)?.servicio_ids.includes(id)) setBarbero(null); setServicio(id) }
  const palabras = p.nombre.split(/\s+/)
  return (
    <div className="pb" style={estiloBarberia(p.color_acento)}>
      <header className="pb-bar">
        <a href="/"><span className="mark">Nº</span>Turnos con NavAgenda</a>
      </header>
      <main className="pb-hero">
        <h1 className="cond" style={{ ['--largo' as string]: Math.max(5, ...palabras.map((x) => x.length)), ['--largo-total' as string]: Math.max(8, p.nombre.length) }}>{p.nombre}</h1>
        <div className="pb-datos">
          {p.direccion && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.direccion}, ${p.ciudad ?? 'La Plata'}`)}`} target="_blank" rel="noopener">
              {p.direccion}{p.barrio ? ` · ${p.barrio}` : ''}
            </a>
          )}
        </div>
        <section className="maq" aria-label="Sacá tu turno" ref={maq}>
          <fieldset>
            <legend>¿Con quién?</legend>
            <div className="chips">
              {[{ id: null as string | null, nombre: 'Cualquiera' }, ...p.barberos].map((b) => (
                <button key={b.id ?? 'todos'} type="button" className="chipb" aria-pressed={barbero === b.id} onClick={() => setBarbero(b.id)}>
                  <span className={`ini ${b.id ? '' : 'todos'}`} aria-hidden>{b.id ? iniciales(b.nombre) : '·'}</span>
                  {b.nombre.split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="knob">
            <b>{serv?.nombre ?? 'Sin servicios'}</b>
            <span>{serv ? pesos(serv.precio) : ''}</span>
            <select value={servicio} onChange={(e) => setServicio(e.target.value)} aria-label="Servicio">
              {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.duracion_min} min · {pesos(s.precio)}</option>)}
            </select>
          </label>
          <div className="dias" role="group" aria-label="Día">
            <button type="button" aria-pressed={!fecha && dia === 0} onClick={() => { setFecha(''); setDia(0) }}>Hoy</button>
            <button type="button" aria-pressed={!fecha && dia === 1} onClick={() => { setFecha(''); setDia(1) }}>Mañana</button>
            <label className={fecha ? 'on' : ''}>{fecha ? diaTxt : 'Otro día'}<input type="date" min={hoyMas(0)} value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Elegir otro día" /></label>
          </div>
          <Led hora={prox ? horaAR(prox.inicio).replace(/^0/, '') : null} />
          <p className="who" aria-live="polite">
            {libres.isPending ? 'Buscando…' : prox ? <>{diaTxt.charAt(0).toUpperCase() + diaTxt.slice(1)} con {nombreDe(prox.barbero_id)}{!barbero && ' · el primero libre'}<small>{serv?.nombre} · {serv?.duracion_min} min · {serv && pesos(serv.precio)}</small></>
              : <>Sin lugar {diaTxt}<small>Probá otro día{barbero ? ' o con otro barbero' : ''}</small></>}
          </p>
          {prox ? (
            <button type="button" className="take" onClick={() => setElegido(prox)}>Sacar el {horaAR(prox.inicio).replace(/^0/, '')} <span aria-hidden>→</span></button>
          ) : !fecha && dia === 0 && !libres.isPending ? (
            <button type="button" className="take alt" onClick={() => setDia(1)}>Ver mañana</button>
          ) : null}
          <p className="fine">Nombre y teléfono, nada más. Sin cuenta, sin seña.</p>
        </section>
      </main>
      {lista.length > 1 && (
        <section className="mas" aria-label="Más horarios">
          <h2>Más horarios {diaTxt}</h2>
          <div className="stubs">
            {lista.slice(1, 13).map((l) => (
              <button key={l.inicio + l.barbero_id} type="button" className="stub" onClick={() => setElegido(l)} aria-label={`${horaAR(l.inicio)} con ${nombreDe(l.barbero_id)}`}>
                <b>{horaAR(l.inicio)}</b><span>con {nombreDe(l.barbero_id)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <Secciones p={p} servicio={servicio} setServicio={elegirServicio} nombreDe={nombreDe} onElegir={setElegido} subir={subir} />
      <dialog ref={hoja} className="hoja-p" onClose={() => setElegido(null)} aria-label="Tus datos">
        {elegido && serv && (
          <Datos slug={p.slug} libre={elegido} servicio={serv} barbero={nombreDe(elegido.barbero_id)} diaTxt={diaDe(elegido.inicio)}
            onListo={(token) => { guardarTicket(token); navigate(`/t/${token}`) }} onCerrar={() => setElegido(null)} />
        )}
      </dialog>
      <p className="pb-bar" style={{ justifyContent: 'center' }}><Link to="/">NavAgenda</Link></p>
    </div>
  )
}

function Datos({ slug, libre, servicio, barbero, diaTxt, onListo, onCerrar }: {
  slug: string; libre: Libre; servicio: Pagina['servicios'][number]; barbero: string; diaTxt: string; onListo: (t: string) => void; onCerrar: () => void
}) {
  const guardado = useMemo(() => { try { return JSON.parse(localStorage.getItem('navagenda-yo') || 'null') } catch { return null } }, [])
  const [nombre, setNombre] = useState(guardado?.nombre ?? '')
  const [tel, setTel] = useState(guardado?.tel ?? '')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (nombre.trim().length < 2) return setError('Poné tu nombre, así te llaman cuando sea tu turno.')
    if (tel.replace(/\D/g, '').length < 10) return setError('Revisá el teléfono: con código de área, sin 0 ni 15. Ej.: 221 456 7890.')
    setEnviando(true); setError('')
    try {
      const r = await api<{ token: string }>(`/p/${slug}/turnos`, { method: 'POST', body: JSON.stringify({ servicio_id: servicio.id, barbero_id: libre.barbero_id, inicio: libre.inicio, nombre: nombre.trim(), telefono: tel }) })
      try { localStorage.setItem('navagenda-yo', JSON.stringify({ nombre: nombre.trim(), tel })) } catch { /* opcional */ }
      onListo(r.token)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos sacar el turno. Probá de nuevo.')
    } finally { setEnviando(false) }
  }

  return (
    <form onSubmit={confirmar} noValidate>
      <button type="button" className="cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
      <div className="res"><b>{horaAR(libre.inicio).replace(/^0/, '')}</b><span>Con {barbero}</span><small>{diaTxt.charAt(0).toUpperCase() + diaTxt.slice(1)} · {servicio.nombre} · {pesos(servicio.precio)}</small></div>
      <label>Tu nombre<span className="ctrl"><input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" autoFocus /></span></label>
      <label>Tu teléfono<span className="ctrl"><span aria-hidden>+54 9</span><input type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} autoComplete="tel-national" /></span>
        <span className="ayuda">Ej.: 221 456 7890, sin 0 ni 15. Lo usamos para sumar tus cortes; no te vamos a escribir.</span></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="take" disabled={enviando}>{enviando ? 'Confirmando…' : 'Confirmar turno'} <span aria-hidden>→</span></button>
    </form>
  )
}
