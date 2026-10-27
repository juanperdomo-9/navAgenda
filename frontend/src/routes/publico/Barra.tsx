import { MapPin, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { atencion, type PaginaBarberia } from './Secciones'

const sinTildes = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, '-')
const SECCIONES = [['turno', 'Sacar turno'], ['barb-h', 'Los barberos'], ['precios-h', 'Precios'], ['semana-h', 'Toda la semana'], ['fid-h', 'Tarjeta de cortes'], ['llegar-h', 'Cómo llegar']] as const

/** Barra de la página de la barbería: su nombre y un menú con sus datos, sus barberos y las secciones. */
export function Barra({ p, onBarbero }: { p: PaginaBarberia; onBarbero: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (abierto) ref.current?.showModal(); else ref.current?.close() }, [abierto])
  const ir = (id: string) => {
    setAbierto(false)
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 50)
  }
  const lugar = [p.direccion, p.barrio, p.ciudad ?? 'La Plata'].filter(Boolean).join(', ')
  return (
    <>
      <header className="pb-nav">
        <a href={`/${p.slug}`} className="pb-marca cond">{p.logo_url && <img src={p.logo_url} alt="" />}{p.nombre}</a>
        <button type="button" className="pb-hamb" onClick={() => setAbierto(true)} aria-label="Abrir el menú" aria-expanded={abierto}><Menu aria-hidden /></button>
      </header>
      <dialog ref={ref} className="pb-menu" onClose={() => setAbierto(false)} aria-label={`Menú de ${p.nombre}`}>
        <div className="bm-cab"><b className="cond">{p.nombre}</b><button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar el menú"><X aria-hidden /></button></div>
        <div className="bm-datos">
          {p.direccion && <a href={`https://www.google.com/maps/search/?api=1&query=${p.lat && p.lng ? `${p.lat},${p.lng}` : encodeURIComponent(lugar)}`} target="_blank" rel="noopener"><MapPin className="i" aria-hidden />{lugar}</a>}
          <dl>{atencion(p).map((x) => [<dt key={'t' + x.d}>{x.dias}</dt>, <dd key={'d' + x.d}>{x.txt}</dd>])}</dl>
        </div>
        <p className="bm-tit">Barberos</p>
        <ul className="bm-barberos">
          {p.barberos.map((b) => {
            const dias = atencion({ ...p, barberos: [b] }).filter((x) => x.txt !== 'Cerrado').map((x) => `${x.dias} ${x.txt}`).join(' · ')
            return (
              <li key={b.id}>
                <button type="button" onClick={() => { onBarbero(b.id); ir('turno') }}>
                  <b>{b.nombre}</b><span>{dias || 'Sin horario cargado'}</span><span>{b.servicio_ids.length} {b.servicio_ids.length === 1 ? 'servicio' : 'servicios'} · Sacar turno con {b.nombre.split(' ')[0]}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <nav aria-label="Secciones">{SECCIONES.map(([id, t]) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); ir(id) }}>{t}</a>)}</nav>
        <a className="bm-nav" href="/">Turnos con NavAgenda</a>
      </dialog>
    </>
  )
}

/** Pie de la página de la barbería, con el crédito de diseño web. */
export function PieBarberia({ p }: { p: PaginaBarberia }) {
  const lugar = [p.direccion, p.barrio, p.ciudad ?? 'La Plata'].filter(Boolean).join(', ')
  return (
    <footer className="pb-pie">
      <div>
        <b className="cond pie-nombre">{p.logo_url && <img src={p.logo_url} alt="" />}{p.nombre}</b>
        {p.direccion && <p>{lugar}</p>}
        <dl>{atencion(p).map((x) => [<dt key={'t' + x.d}>{x.dias}</dt>, <dd key={'d' + x.d}>{x.txt}</dd>])}</dl>
      </div>
      <ul aria-label="Links de cada barbero">
        {p.barberos.map((b) => <li key={b.id}><a href={`/${p.slug}?con=${sinTildes(b.nombre)}`}>Turno con {b.nombre}</a></li>)}
      </ul>
      <p className="pb-legal">
        <a href="/"><span className="mark">Nº</span> Turnos con NavAgenda</a>
        <span>Diseño web: <a href="https://jpweb.com.ar" target="_blank" rel="noopener">jpweb.com.ar</a></span>
      </p>
    </footer>
  )
}
