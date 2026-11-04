import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { api, ApiError } from '@/lib/api'
import { NotFoundPage } from '@/routes/NotFoundPage'
import { estiloBarberia, guardarTicket, horaAR, hoyMas, pesos, tinta } from './comun'
import { Led } from './Led'
import { diaDe, Secciones, type Libre, type PaginaBarberia } from './Secciones'
import { Barra, PieBarberia } from './Barra'
import { Cargando } from './Cargando'
import { Bienvenida, leerGanado, mostrarTalon, PremioActivo, TalonBienvenida, type Ganado } from './Bienvenida'
import { estadoAhora, Galeria } from './Galeria'
import './barberia.css'

type Pagina = PaginaBarberia & { color_acento: string }

const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** navagenda.com.ar/:slug — la página que comparte cada barbería. Diseño: design/barberia. */
export function BarberiaPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const pag = useQuery({ queryKey: ['pagina', slug], queryFn: () => api<Pagina>(`/p/${slug}`), retry: false })
  if (pag.isPending) return <Cargando />
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
  // El servicio se elige al confirmar (junto con nombre y teléfono). Los horarios se calculan con el
  // más corto que haga el barbero (a igual duración, el más barato); `preferido` viene de la lista de precios.
  const servicio = [...servicios].sort((a, b) => a.duracion_min - b.duracion_min || a.precio - b.precio)[0]?.id ?? ''
  const [preferido, setPreferido] = useState<string | null>(null)
  const [dia, setDia] = useState(0)
  const [fecha, setFecha] = useState('')
  const ymd = fecha || hoyMas(dia)
  const diaTxt = fecha ? new Date(fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace(',', '') : dia === 0 ? 'hoy' : 'mañana'

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

  // "Otro horario": todos los libres del día, sin perder el próximo de entrada
  const [ver, setVer] = useState(false)
  const unicos = lista.filter((l, i) => lista.findIndex((x) => x.inicio === l.inicio) === i)
  // Ruleta de bienvenida: talón → (número + ruleta en lugar de la máquina) → premio con 3 minutos
  const [bvAbierta, setBvAbierta] = useState(false)
  const [ganado, setGanado] = useState<Ganado | null>(() => { const g = leerGanado(p.slug); return g && g.vence > Date.now() ? g : null })
  const [talon] = useState(() => !!p.bienvenida && mostrarTalon(p.slug))
  const [elegido, setElegido] = useState<Libre | null>(null)
  const hoja = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (elegido) hoja.current?.showModal(); else hoja.current?.close() }, [elegido])

  const maq = useRef<HTMLElement>(null)
  const subir = () => maq.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  // Desde la lista de precios: si el barbero elegido no hace ese servicio, pasa a "cualquiera"
  const conBarbero = (id: string) => { setBarbero(id); setVer(false); setTimeout(subir, 50) }
  const elegirServicio = (id: string) => { if (barbero && !p.barberos.find((b) => b.id === barbero)?.servicio_ids.includes(id)) setBarbero(null); setPreferido(id) }
  const palabras = p.nombre.split(/\s+/)
  return (
    <div className={`pb ${tinta(p.color_acento) === '#fffdf3' ? 'oscura' : ''}`} style={estiloBarberia(p.color_acento)}>
      <Barra p={p} onBarbero={(id) => { setBarbero(id); setVer(false) }} />
      <main className="pb-hero">
        {p.logo_url && p.logo_fondo !== false && <img className="pb-fondo" src={p.logo_url} alt="" aria-hidden />}
        <h1 className="cond" style={{ ['--largo' as string]: Math.max(5, ...palabras.map((x) => x.length)), ['--largo-total' as string]: Math.max(8, p.nombre.length) }}>{p.nombre}</h1>
        <div className="pb-datos">
          {p.direccion && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.direccion}, ${p.ciudad ?? 'La Plata'}`)}`} target="_blank" rel="noopener">
              {p.direccion}{p.barrio ? ` · ${p.barrio}` : ''}
            </a>
          )}
          {(() => { const e = estadoAhora(p); return e && <span className={`pb-estado ${e.abierto ? 'abierto' : ''}`}>{e.texto}</span> })()}
        </div>
        {talon && !bvAbierta && !ganado && !leerGanado(p.slug) && <TalonBienvenida onAbrir={() => setBvAbierta(true)} />}
        <section className="maq" id="turno" aria-label="Sacá tu turno" ref={maq}>
          {bvAbierta ? <Bienvenida slug={p.slug} premios={p.fidelidad?.ruleta ?? []} onCerrar={() => setBvAbierta(false)} onGanado={(g) => { setGanado(g); setBvAbierta(false) }} /> : <>
          {ganado && <PremioActivo g={ganado} onVence={() => setGanado(null)} />}
          {barbero && (
            <p className="con-quien">Con {p.barberos.find((b) => b.id === barbero)?.nombre}
              <button type="button" onClick={() => { setBarbero(null); setVer(false) }}>Ver con todos</button></p>
          )}
          <div className="dias" role="group" aria-label="Día">
            <button type="button" aria-pressed={!fecha && dia === 0} onClick={() => { setFecha(''); setDia(0); setVer(false) }}>Hoy</button>
            <button type="button" aria-pressed={!fecha && dia === 1} onClick={() => { setFecha(''); setDia(1); setVer(false) }}>Mañana</button>
            <label className={fecha ? 'on' : ''}>{fecha ? diaTxt : 'Otro día'}<input type="date" min={hoyMas(0)} value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Elegir otro día" /></label>
          </div>
          <Led hora={prox ? horaAR(prox.inicio).replace(/^0/, '') : null} />
          <p className="who" aria-live="polite">
            {libres.isPending ? 'Buscando…' : prox ? <>{diaTxt.charAt(0).toUpperCase() + diaTxt.slice(1)} con {nombreDe(prox.barbero_id)}{!barbero && ' · el primero libre'}<small>Desde {pesos(Math.min(...servicios.map((s) => s.precio)))} · el servicio lo elegís al confirmar</small></>
              : <>Sin lugar {diaTxt}<small>Probá otro día{barbero ? ' o con otro barbero' : ''}</small></>}
          </p>
          {prox ? (
            <button type="button" className="take" onClick={() => setElegido(prox)}>Sacar el {horaAR(prox.inicio).replace(/^0/, '')} <span aria-hidden>→</span></button>
          ) : !fecha && dia === 0 && !libres.isPending ? (
            <button type="button" className="take alt" onClick={() => setDia(1)}>Ver mañana</button>
          ) : null}
          {unicos.length > 1 && !barbero && (
            <button type="button" className="otro" aria-expanded={ver} aria-controls="otros" onClick={() => setVer(!ver)}>
              {ver ? 'Ocultar horarios' : `Otro horario · ${unicos.length} libres ${diaTxt}`}
            </button>
          )}
          {(ver || barbero) && unicos.length > 1 && (
            <div className="otros" id="otros" role="group" aria-label={`Horarios libres ${diaTxt}`}>
              {unicos.map((l) => <button key={l.inicio} type="button" onClick={() => setElegido(l)} aria-label={`${horaAR(l.inicio)} con ${nombreDe(l.barbero_id)}`}>{horaAR(l.inicio).replace(/^0/, '')}</button>)}
            </div>
          )}
          <p className="fine">Nombre y teléfono, nada más. Sin cuenta, sin seña.</p>
          </>}
        </section>
      </main>
      <Galeria fotos={p.fotos ?? []} videos={p.videos ?? []} nombre={p.nombre} />
      <Secciones p={p} servicio={servicio} setServicio={elegirServicio} nombreDe={nombreDe} onElegir={setElegido} onBarbero={conBarbero} subir={subir} />
      <dialog ref={hoja} className="hoja-p" onClose={() => setElegido(null)} aria-label="Tus datos">
        {elegido && (
          <Datos slug={p.slug} libre={elegido} telInicial={ganado?.tel} servicios={p.servicios.filter((s) => p.barberos.find((b) => b.id === elegido.barbero_id)?.servicio_ids.includes(s.id))} preferido={preferido} barbero={nombreDe(elegido.barbero_id)} diaTxt={diaDe(elegido.inicio)}
            onListo={(token) => { guardarTicket(token); navigate(`/t/${token}`) }} onCerrar={() => setElegido(null)} />
        )}
      </dialog>
      <PieBarberia p={p} onBarbero={conBarbero} />
    </div>
  )
}

function Datos({ slug, libre, telInicial, servicios, preferido, barbero, diaTxt, onListo, onCerrar }: {
  slug: string; libre: Libre; telInicial?: string; servicios: Pagina['servicios']; preferido: string | null; barbero: string; diaTxt: string; onListo: (t: string) => void; onCerrar: () => void
}) {
  const [sid, setSid] = useState(servicios.find((s) => s.id === preferido)?.id ?? servicios[0]?.id ?? '')
  const servicio = servicios.find((s) => s.id === sid) ?? servicios[0]
  const guardado = useMemo(() => { try { return JSON.parse(localStorage.getItem('navagenda-yo') || 'null') } catch { return null } }, [])
  const [nombre, setNombre] = useState(guardado?.nombre ?? '')
  const [tel, setTel] = useState(telInicial ?? guardado?.tel ?? '')
  const [email, setEmail] = useState(guardado?.email ?? '')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (!servicio) return setError('Elegí qué te hacés.')
    if (nombre.trim().length < 2) return setError('Poné tu nombre, así te llaman cuando sea tu turno.')
    if (tel.replace(/\D/g, '').length < 10) return setError('Revisá el teléfono: con código de área, sin 0 ni 15. Ej.: 221 456 7890.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Poné tu mail: ahí te mandamos el ticket y el recordatorio del turno.')
    setEnviando(true); setError('')
    try {
      const r = await api<{ token: string }>(`/p/${slug}/turnos`, { method: 'POST', body: JSON.stringify({ servicio_id: servicio.id, barbero_id: libre.barbero_id, inicio: libre.inicio, nombre: nombre.trim(), telefono: tel, email: email.trim() }) })
      try { localStorage.setItem('navagenda-yo', JSON.stringify({ nombre: nombre.trim(), tel, email: email.trim() })) } catch { /* opcional */ }
      onListo(r.token)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos sacar el turno. Probá de nuevo.')
    } finally { setEnviando(false) }
  }

  return (
    <form onSubmit={confirmar} noValidate>
      <button type="button" className="cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
      <div className="res"><b>{horaAR(libre.inicio).replace(/^0/, '')}</b><span>Con {barbero}</span><small>{diaTxt.charAt(0).toUpperCase() + diaTxt.slice(1)}</small></div>
      <fieldset className="servs">
        <legend>¿Qué te hacés?</legend>
        {servicios.map((s) => (
          <label key={s.id} className="serv">
            <input type="radio" name="servicio" value={s.id} checked={s.id === sid} onChange={() => { setSid(s.id); setError('') }} />
            <span>{s.nombre}<small>{s.duracion_min} min{s.descripcion ? ` · ${s.descripcion}` : ''}</small></span><b>{pesos(s.precio)}</b>
          </label>
        ))}
      </fieldset>
      <label>Tu nombre<span className="ctrl"><input value={nombre} onChange={(e) => setNombre(e.target.value)} name="na-nombre" autoComplete="off" /></span></label>
      <label>Tu teléfono<span className="ctrl"><span aria-hidden>+54 9</span><input type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} name="na-tel" autoComplete="off" /></span>
        <span className="ayuda">Ej.: 221 456 7890, sin 0 ni 15. Lo usamos para sumar tus cortes; no te vamos a escribir.</span></label>
      <label>Tu mail<span className="ctrl"><input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} name="na-mail" autoComplete="email" placeholder="nombre@gmail.com" /></span>
        <span className="ayuda">Para recordarte el turno el día anterior. Te llega con el link de tu ticket.</span></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="take" disabled={enviando}>{enviando ? 'Confirmando…' : 'Confirmar turno'} <span aria-hidden>→</span></button>
    </form>
  )
}
