import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Gift } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { cargarMapLibre, ESTILO_MAPA } from '@/lib/mapa'
import { hoyMas, horaAR, pesos, ZONA } from './comun'

type Tramo = { dia_semana: number; desde: string; hasta: string }
export type PaginaBarberia = {
  fotos: string[]
  nombre: string; slug: string; logo_url: string | null; direccion: string | null; barrio: string | null; ciudad: string | null; lat: string | null; lng: string | null
  barberos: { id: string; nombre: string; foto_url: string | null; servicio_ids: string[]; horarios: Tramo[] }[]
  servicios: { id: string; nombre: string; precio: number; duracion_min: number }[]
  fidelidad: { cada: number; descripcion: string } | null
}
export type Libre = { inicio: string; fin: string; barbero_id: string }

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const corto = (t: string) => t.slice(0, 5).replace(/^0/, '').replace(':00', '')
const dowDe = (ymd: string) => (new Date(ymd + 'T12:00:00Z').getUTCDay() + 6) % 7 // 0 = lunes
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** "hoy", "mañana" o "mié 23" para un horario. */
export function diaDe(iso: string) {
  const d = new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONA })
  if (d === hoyMas(0)) return 'hoy'
  if (d === hoyMas(1)) return 'mañana'
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', timeZone: ZONA }).replace(',', '').replace('.', '')
}

/** Horario de atención de la barbería: de qué hora a qué hora hay algún barbero, agrupando días iguales. */
export function atencion(p: PaginaBarberia) {
  const txt = DIAS.map((_, d) => {
    const ts = p.barberos.flatMap((b) => b.horarios).filter((t) => t.dia_semana === d)
    if (!ts.length) return 'Cerrado'
    const desde = ts.map((t) => t.desde).sort()[0], hasta = ts.map((t) => t.hasta).sort().at(-1)!
    return `${corto(desde)} a ${corto(hasta)}`
  })
  const g: { d: number; h: number; txt: string }[] = []
  txt.forEach((t, d) => { const u = g.at(-1); if (u && u.txt === t) u.h = d; else g.push({ d, h: d, txt: t }) })
  return g.map((x) => ({ ...x, dias: x.d === x.h ? DIAS[x.d] : `${DIAS[x.d]} a ${DIAS[x.h].toLowerCase()}` }))
}

export function Secciones({ p, servicio, setServicio, nombreDe, onElegir, subir }: {
  p: PaginaBarberia; servicio: string; setServicio: (id: string) => void; nombreDe: (id: string) => string
  onElegir: (l: Libre) => void; subir: () => void
}) {
  const libresDe = (o: number) => ({
    queryKey: ['libres', p.slug, servicio, hoyMas(o), null],
    queryFn: () => api<Libre[]>(`/p/${p.slug}/libres?servicio_id=${servicio}&fecha=${hoyMas(o)}`),
    enabled: !!servicio,
  })
  const hoy = useQuery(libresDe(0))
  const man = useQuery(libresDe(1))
  const [semana, setSemana] = useState(0)
  const dia = useQuery(libresDe(semana))
  const abierto = (o: number) => p.barberos.some((b) => b.horarios.some((t) => t.dia_semana === dowDe(hoyMas(o))))
  const hoyDow = dowDe(hoyMas(0))
  const lugar = [p.direccion, p.barrio, p.ciudad ?? 'La Plata'].filter(Boolean).join(', ')
  const ir = p.lat && p.lng ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar)}`

  return (
    <>
      <section className="sec barberos-sec" aria-labelledby="barb-h">
        <div>
          <h2 className="sec-h" id="barb-h">{p.barberos.length === 1 ? 'El barbero' : 'Los barberos'}</h2>
          <p className="sec-lede">Elegí con quién. Tocá el horario y es tuyo.</p>
        </div>
        <ol className="lineup">
          {p.barberos.map((b) => {
            const prox = hoy.data?.find((l) => l.barbero_id === b.id) ?? man.data?.find((l) => l.barbero_id === b.id)
            const dias = atencion({ ...p, barberos: [b] }).filter((x) => x.txt !== 'Cerrado').map((x) => x.dias).join(', ')
            return (
              <li key={b.id}>
                <span className="nom">{b.foto_url && <img className="cara" src={b.foto_url} alt="" />}{nombreDe(b.id)}</span>
                <span className="det">{b.nombre}{dias ? ` · ${dias}` : ''}</span>
                <button className="sacar" type="button" disabled={!prox} onClick={() => prox && onElegir(prox)}
                  aria-label={prox ? `Sacar ${diaDe(prox.inicio)} a las ${horaAR(prox.inicio)} con ${b.nombre}` : `${b.nombre} no tiene lugar hoy ni mañana`}>
                  <small>{prox ? (diaDe(prox.inicio) === 'hoy' ? 'Libre hoy' : 'Mañana') : 'Sin lugar'}</small><b>{prox ? horaAR(prox.inicio) : '--:--'}</b>
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="banda">
        <section className="sec precios" aria-labelledby="precios-h">
          <div>
            <h2 className="sec-h" id="precios-h">Lista de precios</h2>
            <p className="sec-lede">Tocá un servicio y te lo dejamos elegido para cuando saques el turno.</p>
          </div>
          <div className="caja">
            <h3>{p.nombre}</h3>
            <ul>{p.servicios.map((s) => (
              <li key={s.id}><button type="button" onClick={() => { setServicio(s.id); subir() }}>
                {s.nombre} <small>{s.duracion_min} min</small><span className="lead" /><b>{pesos(s.precio)}</b></button></li>))}</ul>
            <p className="pie-caja">Se paga en el local. Sin seña.</p>
          </div>
        </section>
      </div>

      <section className="sec" aria-labelledby="semana-h">
        <h2 className="sec-h" id="semana-h">Toda la semana</h2>
        <p className="sec-lede">Para elegir con calma: el día y después el horario con cada barbero.</p>
        <div className="dias7" role="group" aria-label="Día de la semana">
          {Array.from({ length: 7 }, (_, o) => {
            const f = hoyMas(o), cerrado = !abierto(o)
            return <button key={o} type="button" aria-pressed={o === semana} disabled={cerrado} onClick={() => setSemana(o)}
              aria-label={cerrado ? `${DIAS[dowDe(f)]}, cerrado` : undefined}>{o === 0 ? 'Hoy' : DIAS[dowDe(f)]}<b>{+f.slice(8)}</b></button>
          })}
        </div>
        <div className="grilla" aria-live="polite">
          {dia.isPending ? <p className="nada">Buscando…</p> : p.barberos.map((b) => {
            const hs = (dia.data ?? []).filter((l) => l.barbero_id === b.id)
            const cuando = semana === 0 ? 'hoy' : semana === 1 ? 'mañana' : `el ${DIAS[dowDe(hoyMas(semana))].toLowerCase()}`
            return (
              <div key={b.id}><h3>{nombreDe(b.id)}</h3>
                {hs.length ? <div className="horas">{hs.map((l) => <button key={l.inicio} type="button" onClick={() => onElegir(l)} aria-label={`${horaAR(l.inicio)} con ${b.nombre}, ${diaDe(l.inicio)}`}>{horaAR(l.inicio)}</button>)}</div>
                  : <p className="nada">Sin lugar {cuando}.</p>}
              </div>
            )
          })}
        </div>
      </section>

      {p.fidelidad && <Fidelidad nombre={p.nombre} cada={p.fidelidad.cada} descripcion={p.fidelidad.descripcion} />}

      <div className="banda">
        <section className="sec llegar" aria-labelledby="llegar-h">
          <div>
            <h2 className="sec-h" id="llegar-h">Cómo llegar</h2>
            {p.direccion && <p className="dir">{p.direccion}</p>}
            <p className="sec-lede">{[p.barrio, p.ciudad ?? 'La Plata'].filter(Boolean).join(', ')}</p>
            <dl className="atencion">{atencion(p).map((x) => {
              const esHoy = hoyDow >= x.d && hoyDow <= x.h
              return [<dt key={'t' + x.d} className={esHoy ? 'hoy' : ''}>{x.dias}</dt>, <dd key={'d' + x.d} className={esHoy ? 'hoy' : ''}>{x.txt}</dd>]
            })}</dl>
            <a className="ir" href={ir} target="_blank" rel="noopener">Abrir en el mapa <ArrowRight className="i" aria-hidden /></a>
          </div>
          {p.lat && p.lng && <Mapa lat={+p.lat} lng={+p.lng} nombre={p.nombre} />}
        </section>
      </div>
    </>
  )
}

const TIJERA = <svg className="t" viewBox="0 0 24 24" aria-hidden><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" /></svg>
const RAYA = <svg className="raya" viewBox="0 0 52 52" aria-hidden><path d="M8 40 C 18 30, 30 20, 45 10" /></svg>

/** Tarjeta de tijeras: cuando se ve, se tachan de a una y al final aparece el premio. */
function Fidelidad({ nombre, cada, descripcion }: { nombre: string; cada: number; descripcion: string }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  function jugar() {
    timers.current.forEach(clearTimeout)
    if (reducido()) return setN(cada)
    setN(0)
    timers.current = Array.from({ length: cada }, (_, i) => window.setTimeout(() => setN(i + 1), 500 + i * 520))
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { jugar(); io.disconnect() } }, { threshold: 0.5 })
    io.observe(el)
    return () => { io.disconnect(); timers.current.forEach(clearTimeout) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const completa = n >= cada
  return (
    <section className="fidelidad" aria-labelledby="fid-h">
      <div>
        <h2 id="fid-h">{descripcion}</h2>
        <p className="bajada">Venís, te cortás y tachamos una tijera. Cuando completás la tarjeta, te llevás el premio. Se cuenta con tu teléfono: sin tarjetita ni app.</p>
      </div>
      <div className="carton" ref={ref}>
        <h3><span>{nombre}</span><span>Tu tarjeta</span></h3>
        <div className="tarjeta" role="img" aria-label={`Tarjeta de ${cada} cortes`}>
          {Array.from({ length: cada }, (_, i) => <span key={i} className={`tijera ${i < n ? 'tachada' : ''}`}>{TIJERA}{RAYA}</span>)}
          <span className={`premio ${completa ? 'ganado' : ''}`}><Gift className="i" aria-hidden />Premio</span>
        </div>
        <p className="estado-juego" aria-live="polite">{completa ? '¡Tarjeta completa! El próximo turno va con premio.' : n === 0 ? 'Cada corte tacha una tijera.' : `Van ${n}. ${cada - n === 1 ? 'Falta 1' : `Faltan ${cada - n}`}.`}</p>
        {completa && <button className="otra" type="button" onClick={jugar}>Ver de nuevo</button>}
      </div>
    </section>
  )
}

/** Mapa con MapLibre + OpenFreeMap (se carga solo si la barbería marcó su ubicación). */
function Mapa({ lat, lng, nombre }: { lat: number; lng: number; nombre: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let mapa: { remove: () => void } | undefined
    let vivo = true
    cargarMapLibre().then((ml) => {
      if (!vivo || !ref.current) return
      const m = new ml.Map({ container: ref.current, style: ESTILO_MAPA, center: [lng, lat], zoom: 15, cooperativeGestures: true, attributionControl: { compact: true } })
      m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
      const el = document.createElement('div'); el.className = 'pin-b'
      const b = document.createElement('b'); b.textContent = nombre; el.appendChild(b)
      new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(m)
      mapa = m
    }).catch(() => setError(true))
    return () => { vivo = false; mapa?.remove() }
  }, [lat, lng, nombre])
  return (
    <div className="mapa" ref={ref} role="region" aria-label={`Mapa con la ubicación de ${nombre}`}>
      {error && <p style={{ padding: 24, font: '600 15px Archivo', color: 'var(--ink)' }}>No pudimos cargar el mapa. La dirección está al lado.</p>}
    </div>
  )
}
