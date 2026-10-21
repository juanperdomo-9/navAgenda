import { useQuery } from '@tanstack/react-query'
import { ArrowRight, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '@/lib/api'
import { Led } from './publico/Led'
import { horaAR, pesos, ZONA } from './publico/comun'
import './publico/barberia.css'
import './portal.css'

type Item = { nombre: string; slug: string; color_acento: string; direccion: string | null; barrio: string | null; precio_desde: number; proximo_libre: string | null }

const cuando = (iso: string) => {
  const d = new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONA })
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: ZONA })
  const man = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: ZONA })
  return d === hoy ? 'hoy' : d === man ? 'mañana' : new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', timeZone: ZONA })
}

/** Portal NavAgenda (diseño: design/hero): el próximo turno libre entre todas las barberías y el listado. */
export function HomePage() {
  const q = useQuery({ queryKey: ['portal'], queryFn: () => api<Item[]>('/p'), refetchInterval: 60_000 })
  const lista = q.data ?? []
  const prox = lista.find((x) => x.proximo_libre)
  return (
    <div className="portal">
      <header className="pb-bar"><span className="logo cond"><span className="mark">Nº</span> NavAgenda</span><Link className="mis" to="/panel/ingresar">Soy barbería</Link></header>
      <main className="portal-hero">
        <h1 className="cond">Sacá<br />número.</h1>
        <p className="sinfila"><span>Sin fila</span><span>Sin cuenta</span><span>Sin seña</span></p>
        <section className="maq" aria-label="El próximo turno libre">
          <p className="cap">Próximo libre en La Plata</p>
          <Led hora={prox?.proximo_libre ? horaAR(prox.proximo_libre).replace(/^0/, '') : null} />
          <p className="who">{q.isPending ? 'Buscando…' : prox?.proximo_libre ? <>{prox.nombre}<small>{cuando(prox.proximo_libre)} · desde {pesos(prox.precio_desde)}</small></> : <>Sin turnos por ahora<small>Volvé en un rato</small></>}</p>
          {prox && <Link className="take" to={`/${prox.slug}`}>Sacar turno ahí <ArrowRight aria-hidden /></Link>}
          <p className="fine">Nombre y teléfono, nada más.</p>
        </section>
      </main>
      <section className="rollos-sec" aria-labelledby="barb-h">
        <h2 id="barb-h" className="cond">Barberías</h2>
        <ul className="rollos">
          {lista.map((b) => (
            <li key={b.slug}>
              <Link to={`/${b.slug}`} className="rollo" style={{ ['--c' as string]: b.color_acento }}>
                <span className="mini"><small>Libre</small><b>{b.proximo_libre ? horaAR(b.proximo_libre) : '--:--'}</b></span>
                <span className="txt"><b>{b.nombre}</b><span><MapPin aria-hidden className="i" />{[b.barrio, b.direccion].filter(Boolean).join(' · ')}</span>
                  <span>{b.proximo_libre ? `Libre ${cuando(b.proximo_libre)} · ` : ''}desde {pesos(b.precio_desde)}</span></span>
                <ArrowRight aria-hidden className="i flecha" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <footer className="pb-bar portal-pie"><span>NavAgenda · La Plata</span><Link to="/panel/ingresar">Ingresar al panel</Link></footer>
    </div>
  )
}
