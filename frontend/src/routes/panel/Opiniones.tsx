import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, X } from 'lucide-react'
import { useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { Estrellas, type ResumenOpiniones } from '../publico/Opiniones'

type Opinion = { id: string; nombre: string; cliente: string; telefono: string; estrellas: number; texto: string | null; video_url: string | null; barbero: string; servicio: string; fecha: string; visible: boolean }

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })

/** Lo que opinan los clientes que fueron. Las de 4-5 estrellas salen solas en la página; el resto, si las mostrás. */
export function Opiniones() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['p-opiniones'], queryFn: () => api<{ resumen: ResumenOpiniones; lista: Opinion[] }>('/panel/opiniones') })
  const [aviso, setAviso] = useState('')
  const [borrando, setBorrando] = useState<string | null>(null)
  async function mostrar(o: Opinion) {
    try {
      await api(`/panel/opiniones/${o.id}`, { method: 'PATCH', body: JSON.stringify({ visible: !o.visible }) })
      setAviso(o.visible ? 'Ya no se ve en tu página.' : 'Ahora se ve en tu página.')
      qc.invalidateQueries({ queryKey: ['p-opiniones'] })
    } catch (e) { setAviso(e instanceof ApiError ? e.message : 'No se pudo guardar.') }
  }
  async function borrar(o: Opinion) {
    await api(`/panel/opiniones/${o.id}`, { method: 'DELETE' })
    setBorrando(null); setAviso('Opinión borrada.')
    qc.invalidateQueries({ queryKey: ['p-opiniones'] })
  }
  const r = q.data?.resumen
  const lista = q.data?.lista ?? []
  return (
    <main>
      <div className="titulo"><h1 className="cond">Opiniones</h1>
        <p>Las dejan los clientes que fueron, desde su ticket (al día siguiente les llega un mail). Las de 4 y 5 estrellas se publican solas; las demás, si vos querés.</p></div>
      {r?.cantidad ? <div className="tablero"><div className="dato"><small>Promedio en tu página</small><b>{r.promedio?.toLocaleString('es-AR')} ★</b></div><div className="dato"><small>Publicadas</small><b>{r.cantidad}</b></div><div className="dato"><small>Recibidas</small><b>{lista.length}</b></div></div> : null}
      {aviso && <p role="status" className="vacio" style={{ padding: 12, marginTop: 14 }}>{aviso}</p>}
      {q.isPending ? <p style={{ marginTop: 16 }}>Cargando…</p>
        : !lista.length ? <div className="vacio" style={{ marginTop: 16 }}><b className="cond">Todavía no hay opiniones</b>Cuando marques "Asistió", el cliente puede opinar desde su ticket.</div>
        : <ul className="lista">{lista.map((o) => (
          <li key={o.id} className={`opinion ${o.visible ? '' : 'oculta'}`}>
            <span>
              <span className="n cond">{o.cliente}</span> <Estrellas n={o.estrellas} />
              <span className="r" style={{ display: 'block' }}>{fecha(o.fecha)} · {o.servicio} con {o.barbero} · {o.visible ? 'se ve en tu página' : 'oculta'}</span>
              {o.texto && <span style={{ display: 'block', marginTop: 6, fontWeight: 600 }}>“{o.texto}”</span>}
              {o.video_url && <video src={o.video_url} controls playsInline preload="metadata" style={{ display: 'block', marginTop: 8, maxWidth: 260, borderRadius: 8 }} />}
            </span>
            <span className="acc" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
              <button type="button" className="link" onClick={() => mostrar(o)}>{o.visible ? <><EyeOff className="i" aria-hidden />Ocultar</> : <><Eye className="i" aria-hidden />Mostrar en mi página</>}</button>
              {borrando === o.id ? <span className="botones"><button type="button" className="btn peligro chico" onClick={() => borrar(o)}>Sí, borrar</button><button type="button" className="btn sec chico" onClick={() => setBorrando(null)}>No</button></span>
                : <button type="button" className="link rojo" onClick={() => setBorrando(o.id)}><X className="i" aria-hidden />Borrar</button>}
            </span>
          </li>))}</ul>}
    </main>
  )
}
