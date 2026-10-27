import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ZONA } from './comun'
import type { PaginaBarberia } from './Secciones'

/** Fotos del local: una grande y dos chicas (como una vidriera); "Ver todas" las abre en pantalla completa. */
export function Galeria({ fotos, nombre }: { fotos: string[]; nombre: string }) {
  const [abierta, setAbierta] = useState<number | null>(null)
  const ref = useRef<HTMLDialogElement>(null)
  const tira = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (abierta === null) { ref.current?.close(); return }
    ref.current?.showModal()
    tira.current?.children[abierta]?.scrollIntoView({ behavior: 'instant', inline: 'start' })
  }, [abierta])
  if (!fotos.length) return null
  const mover = (d: number) => tira.current?.scrollBy({ left: d * (tira.current?.clientWidth ?? 0), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  return (
    <section className="galeria" aria-label={`Fotos de ${nombre}`}>
      <div className={`gal-grilla n${Math.min(fotos.length, 3)}`}>
        {fotos.slice(0, 3).map((f, i) => (
          <button key={f} type="button" onClick={() => setAbierta(i)} aria-label={`Ver foto ${i + 1} de ${fotos.length}`}>
            <img src={f} alt="" loading={i ? 'lazy' : 'eager'} />
            {i === Math.min(fotos.length, 3) - 1 && fotos.length > 1 && <span className="gal-todas">Ver todas ({fotos.length})</span>}
          </button>
        ))}
      </div>
      <dialog ref={ref} className="gal-full" onClose={() => setAbierta(null)} aria-label={`Fotos de ${nombre}`}>
        <button type="button" className="gal-cerrar" onClick={() => setAbierta(null)} aria-label="Cerrar las fotos"><X aria-hidden /></button>
        <div className="gal-tira" ref={tira}>
          {fotos.map((f, i) => <figure key={f}><img src={f} alt={`Foto ${i + 1} de ${fotos.length} de ${nombre}`} loading="lazy" /><figcaption>{i + 1} / {fotos.length}</figcaption></figure>)}
        </div>
        {fotos.length > 1 && <>
          <button type="button" className="gal-flecha izq" onClick={() => mover(-1)} aria-label="Foto anterior"><ChevronLeft aria-hidden /></button>
          <button type="button" className="gal-flecha der" onClick={() => mover(1)} aria-label="Foto siguiente"><ChevronRight aria-hidden /></button>
        </>}
      </dialog>
    </section>
  )
}

const corto = (t: string) => t.slice(0, 5).replace(/^0/, '').replace(':00', '')
const DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** "Abierto hasta las 18" / "Abre hoy a las 12" / "Cerrado · abre mañana a las 12", con los horarios de los barberos. */
export function estadoAhora(p: PaginaBarberia): { abierto: boolean; texto: string } | null {
  const ahora = new Date()
  const hoy = (new Date(ahora.toLocaleDateString('en-CA', { timeZone: ZONA }) + 'T12:00:00Z').getUTCDay() + 6) % 7
  const hm = ahora.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA })
  const tramos = (d: number) => p.barberos.flatMap((b) => b.horarios).filter((t) => t.dia_semana === d)
  const hoyT = tramos(hoy)
  if (hoyT.length) {
    const abre = hoyT.map((t) => t.desde.slice(0, 5)).sort()[0], cierra = hoyT.map((t) => t.hasta.slice(0, 5)).sort().at(-1)!
    if (hm >= abre && hm < cierra) return { abierto: true, texto: `Abierto hasta las ${corto(cierra)}` }
    if (hm < abre) return { abierto: false, texto: `Abre hoy a las ${corto(abre)}` }
  }
  for (let k = 1; k <= 7; k++) {
    const d = (hoy + k) % 7, ts = tramos(d)
    if (ts.length) return { abierto: false, texto: `Cerrado · abre ${k === 1 ? 'mañana' : `el ${DIA[d]}`} a las ${corto(ts.map((t) => t.desde.slice(0, 5)).sort()[0])}` }
  }
  return null
}
