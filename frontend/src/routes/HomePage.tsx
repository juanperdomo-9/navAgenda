import { useQuery } from '@tanstack/react-query'
import { ArrowRight, LocateFixed, MapPin, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '@/lib/api'
import { cargarMapLibre, ESTILO_MAPA, LA_PLATA } from '@/lib/mapa'
import { Led } from './publico/Led'
import { horaAR, pesos, ZONA } from './publico/comun'
import './publico/barberia.css'
import './portal.css'

type Item = { nombre: string; slug: string; color_acento: string; logo_url: string | null; direccion: string | null; barrio: string | null; lat: string | null; lng: string | null; precio_desde: number; proximo_libre: string | null }
type Punto = { lat: number; lng: number }

const cuando = (iso: string) => {
  const d = new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONA })
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: ZONA })
  const man = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: ZONA })
  return d === hoy ? 'hoy' : d === man ? 'mañana' : new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', timeZone: ZONA })
}
const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
/** Distancia en metros (haversine). */
function metros(a: Punto, b: Punto) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * 6371e3 * Math.asin(Math.sqrt(h))
}
const distancia = (m: number) => (m < 1000 ? `a ${Math.round(m / 50) * 50 || 50} m` : `a ${(m / 1000).toFixed(1).replace('.', ',')} km`)

/** Portal NavAgenda (diseño: design/hero): el próximo turno libre, el mapa y todas las barberías. */
export function HomePage() {
  const q = useQuery({ queryKey: ['portal'], queryFn: () => api<Item[]>('/p'), refetchInterval: 60_000 })
  const lista = q.data ?? []
  const prox = lista.filter((x) => x.proximo_libre).sort((a, b) => a.proximo_libre!.localeCompare(b.proximo_libre!))[0]
  const [yo, setYo] = useState<Punto | null>(null)
  const [ubic, setUbic] = useState<'' | 'buscando' | 'error'>('')
  const [filtro, setFiltro] = useState('')

  const ordenadas = useMemo(() => {
    const f = sinTildes(filtro.trim())
    return lista
      .filter((b) => !f || sinTildes(`${b.nombre} ${b.barrio ?? ''} ${b.direccion ?? ''}`).includes(f))
      .map((b) => ({ ...b, m: yo && b.lat && b.lng ? metros(yo, { lat: +b.lat, lng: +b.lng }) : null }))
      .sort((a, b) => (a.m ?? Infinity) - (b.m ?? Infinity) || a.nombre.localeCompare(b.nombre))
  }, [lista, yo, filtro])
  const cerca = yo ? ordenadas.find((b) => b.m !== null) : undefined

  function ubicarme() {
    if (!navigator.geolocation) return setUbic('error')
    setUbic('buscando')
    navigator.geolocation.getCurrentPosition(
      (p) => { setYo({ lat: p.coords.latitude, lng: p.coords.longitude }); setUbic('') },
      () => setUbic('error'),
      { timeout: 10_000, maximumAge: 300_000 },
    )
  }

  return (
    <div className="portal">
      <header className="pb-bar"><span className="logo cond"><span className="mark">Nº</span> NavAgenda</span><Link className="mis" to="/panel/ingresar">Soy barbería</Link></header>
      <main>
        <div className="portal-hero">
          <h1 className="cond">Sacá<br />número.</h1>
          <p className="sinfila"><span>Sin fila</span><span>Sin cuenta</span><span>Sin seña</span></p>
          <section className="maq" aria-label="El próximo turno libre">
            <p className="cap">Próximo libre en La Plata</p>
            <Led hora={prox?.proximo_libre ? horaAR(prox.proximo_libre).replace(/^0/, '') : null} />
            <p className="who">{q.isPending ? 'Buscando…' : prox?.proximo_libre ? <>{prox.nombre}<small>{cuando(prox.proximo_libre)} · desde {pesos(prox.precio_desde)}</small></> : <>Sin turnos por ahora<small>Volvé en un rato</small></>}</p>
            {prox && <Link className="take" to={`/${prox.slug}`}>Sacar turno ahí <ArrowRight aria-hidden /></Link>}
            <p className="fine">Nombre y teléfono, nada más.</p>
          </section>
        </div>

        <section className="cerca-sec" aria-labelledby="cerca-h" id="barberias">
          <div className="cerca-cab">
            <h2 id="cerca-h" className="cond">Cerca tuyo</h2>
            <button type="button" className="ubicarme" onClick={ubicarme} disabled={ubic === 'buscando'}>
              <LocateFixed className="i" aria-hidden />{ubic === 'buscando' ? 'Buscando…' : yo ? 'Actualizar mi ubicación' : 'Usar mi ubicación'}
            </button>
          </div>
          <p className="cerca-txt" aria-live="polite">
            {ubic === 'error' ? 'No pudimos saber dónde estás. Buscá por barrio acá abajo.'
              : cerca ? <>La más cerca: <Link to={`/${cerca.slug}`}>{cerca.nombre}</Link>, {distancia(cerca.m!)}.</>
              : 'Tocá "Usar mi ubicación" y te ordenamos las barberías por cercanía.'}
          </p>
          <MapaPortal barberias={lista} yo={yo} cerca={cerca?.slug} />

          <div className="todas-cab">
            <h3 className="cond">Todas las barberías{lista.length ? ` (${lista.length})` : ''}</h3>
            <label className="filtro"><Search className="i" aria-hidden /><span className="sr-only">Buscar barbería</span>
              <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nombre o barrio" autoComplete="off" /></label>
          </div>
          {q.isPending ? <p className="cerca-txt">Cargando…</p>
            : !ordenadas.length ? <p className="cerca-txt">{filtro ? `Ninguna barbería con "${filtro}".` : 'Todavía no hay barberías.'}</p>
            : <ul className="rollos">
              {ordenadas.map((b) => (
                <li key={b.slug}>
                  <Link to={`/${b.slug}`} className={`rollo ${cerca?.slug === b.slug ? 'la-cerca' : ''}`} style={{ ['--c' as string]: b.color_acento }}>
                    <span className="txt"><b className={b.logo_url ? 'con-logo' : ''}>{b.logo_url && <img src={b.logo_url} alt="" />}{b.nombre}</b>
                      <span><MapPin aria-hidden className="i" />{[b.barrio, b.direccion].filter(Boolean).join(' · ') || 'La Plata'}</span>
                      <span>Desde {pesos(b.precio_desde)}{b.m !== null ? ` · ${distancia(b.m)}` : ''}</span></span>
                    {cerca?.slug === b.slug && <span className="sello-cerca">La más cerca</span>}
                    <ArrowRight aria-hidden className="i flecha" />
                  </Link>
                </li>
              ))}
            </ul>}
        </section>

        <section className="sumar-sec" aria-labelledby="sumar-h">
          <h2 id="sumar-h" className="cond">¿Tenés una barbería?</h2>
          <p>Tu link para que te saquen turno solos, la grilla de tus barberos, la tarjeta de cortes y tus números. Sin seña y sin que tus clientes se hagan cuenta.</p>
          <Link className="take" to="/sumar">Quiero sumar mi barbería <ArrowRight aria-hidden /></Link>
        </section>
      </main>
      <Pie />
    </div>
  )
}

export function Pie() {
  return (
    <footer className="portal-pie">
      <div className="pie-marca"><span className="logo cond"><span className="mark">Nº</span> NavAgenda</span>
        <p>Turnos para barberías de La Plata.<br />Sin fila. Sin cuenta. Sin seña.</p></div>
      <nav aria-label="Pie">
        <a href="/#barberias">Barberías</a>
        <Link to="/sumar">Sumá tu barbería</Link>
        <Link to="/panel/ingresar">Ingresar al panel</Link>
      </nav>
      <p className="pie-legal">© {new Date().getFullYear()} NavAgenda · Hecho en La Plata · Desarrollo web: <a href="https://jpweb.com.ar" target="_blank" rel="noopener">jpweb.com.ar</a></p>
    </footer>
  )
}

/** Mapa con todas las barberías; si sabemos dónde estás, te muestra y encuadra la más cercana. */
function MapaPortal({ barberias, yo, cerca }: { barberias: Item[]; yo: Punto | null; cerca?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const mapa = useRef<import('maplibre-gl').Map | null>(null)
  const ml = useRef<Awaited<ReturnType<typeof cargarMapLibre>> | null>(null)
  const marcas = useRef<import('maplibre-gl').Marker[]>([])
  const [listo, setListo] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let vivo = true
    cargarMapLibre().then((m) => {
      if (!vivo || !ref.current) return
      ml.current = m
      mapa.current = new m.Map({ container: ref.current, style: ESTILO_MAPA, center: LA_PLATA, zoom: 12.5, cooperativeGestures: true, attributionControl: { compact: true } })
      mapa.current.addControl(new m.NavigationControl({ showCompass: false }), 'top-right')
      // Con poco zoom van puntos; de cerca, el nombre de cada barbería
      const zoom = () => ref.current?.classList.toggle('de-cerca', (mapa.current?.getZoom() ?? 0) >= 14.5)
      mapa.current.on('zoom', zoom)
      zoom()
      setListo(true)
    }).catch(() => setError(true))
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null }
  }, [])

  useEffect(() => {
    const m = mapa.current, lib = ml.current
    if (!listo || !m || !lib) return
    marcas.current.forEach((x) => x.remove())
    marcas.current = []
    const puntos: [number, number][] = []
    for (const b of barberias) {
      if (!b.lat || !b.lng) continue
      const a = document.createElement('a')
      a.href = `/${b.slug}`
      a.className = `pin-p ${b.slug === cerca ? 'cerca' : ''}`
      a.style.setProperty('--c', b.color_acento)
      a.setAttribute('aria-label', `${b.nombre}: sacar turno`)
      a.appendChild(document.createElement('i'))
      const t = document.createElement('b'); t.textContent = b.nombre; a.appendChild(t)
      marcas.current.push(new lib.Marker({ element: a, anchor: 'bottom' }).setLngLat([+b.lng, +b.lat]).addTo(m))
      puntos.push([+b.lng, +b.lat])
    }
    if (yo) {
      const el = document.createElement('span'); el.className = 'pin-yo'; el.setAttribute('aria-label', 'Vos estás acá')
      marcas.current.push(new lib.Marker({ element: el }).setLngLat([yo.lng, yo.lat]).addTo(m))
      const c = barberias.find((b) => b.slug === cerca)
      const enfoque: [number, number][] = c?.lat && c.lng ? [[yo.lng, yo.lat], [+c.lng, +c.lat]] : [[yo.lng, yo.lat]]
      const bb = enfoque.reduce((acc, p) => acc.extend(p), new lib.LngLatBounds(enfoque[0], enfoque[0]))
      m.fitBounds(bb, { padding: 70, maxZoom: 15, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800 })
    } else if (puntos.length > 1) {
      const bb = puntos.reduce((acc, p) => acc.extend(p), new lib.LngLatBounds(puntos[0], puntos[0]))
      m.fitBounds(bb, { padding: 60, maxZoom: 14, duration: 0 })
    }
  }, [listo, barberias, yo, cerca])

  return (
    <div className="mapa-portal" ref={ref} role="region" aria-label="Mapa de las barberías">
      {error && <p style={{ padding: 20 }}>No pudimos cargar el mapa. Las barberías están acá abajo.</p>}
    </div>
  )
}
