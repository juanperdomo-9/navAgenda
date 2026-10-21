import { useEffect, useState } from 'react'
import { Led } from './Led'

/** Pantalla de carga: el display del turnero con el LED titilando. Si la API tarda (se despierta), lo avisa. */
export function Cargando({ texto = 'Buscando turnos…' }: { texto?: string }) {
  const [lento, setLento] = useState(false)
  useEffect(() => { const t = setTimeout(() => setLento(true), 4000); return () => clearTimeout(t) }, [])
  return (
    <div className="cargando" role="status" aria-live="polite">
      <span className="logo"><span className="mark">Nº</span> NavAgenda</span>
      <div className="cargando-maq">
        <Led hora={null} className="titila" />
        <p>{texto}</p>
        {lento && <small>La primera vez puede tardar unos segundos. Ya casi.</small>}
      </div>
    </div>
  )
}
