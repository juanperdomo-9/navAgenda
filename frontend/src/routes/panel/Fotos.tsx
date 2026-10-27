import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { achicar } from './Logo'

const MAXIMO = 8
const error = (e: unknown) => (e instanceof ApiError ? e.message : 'No pudimos subir esa imagen. Probá con un JPG o PNG.')

/** Fotos del local (hasta 8): se ven en la página de la barbería, debajo de la máquina de turnos. */
export function FotosLocal({ onAviso }: { onAviso: (m: string) => void }) {
  const qc = useQueryClient()
  const fotos = useQuery({ queryKey: ['p-fotos'], queryFn: () => api<{ id: string; url: string }[]>('/panel/fotos') })
  const input = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const lista = fotos.data ?? []
  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return
    setSubiendo(true)
    let n = 0
    try {
      for (const f of [...archivos].slice(0, MAXIMO - lista.length)) {
        await api('/panel/fotos', { method: 'POST', body: JSON.stringify({ imagen: await achicar(f, 1600, 'image/jpeg') }) })
        n++
      }
      onAviso(n === 1 ? 'Foto agregada a tu página.' : `${n} fotos agregadas a tu página.`)
    } catch (e) { onAviso(error(e)) } finally {
      setSubiendo(false)
      if (input.current) input.current.value = ''
      qc.invalidateQueries({ queryKey: ['p-fotos'] })
    }
  }
  async function borrar(id: string) {
    await api(`/panel/fotos/${id}`, { method: 'DELETE' })
    qc.invalidateQueries({ queryKey: ['p-fotos'] })
  }
  return (
    <section className="bloque"><h3 className="cond">Fotos del local <small>{lista.length}/{MAXIMO}</small></h3>
      <p className="ayuda" style={{ marginTop: 10 }}>Se ven en tu página, debajo de la máquina de turnos. La primera es la grande: el local, los sillones, cortes que hicieron.</p>
      <ul className="fotos-ed">
        {lista.map((f, i) => (
          <li key={f.id}><img src={f.url} alt={`Foto ${i + 1}`} /><button type="button" onClick={() => borrar(f.id)} aria-label={`Borrar la foto ${i + 1}`}><X aria-hidden /></button></li>
        ))}
        {lista.length < MAXIMO && (
          <li><button type="button" className="fotos-mas" onClick={() => input.current?.click()} disabled={subiendo}><ImagePlus aria-hidden />{subiendo ? 'Subiendo…' : 'Agregar'}</button></li>
        )}
      </ul>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => subir(e.target.files)} />
    </section>
  )
}

/** Foto de un barbero: aparece en "Los barberos" y en el menú de la página. */
export function FotoBarbero({ id, url, nombre, onCambio }: { id: string; url: string | null; nombre: string; onCambio: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState('')
  async function subir(f: File | undefined) {
    if (!f) return
    setSubiendo(true); setMsg('')
    try {
      await api(`/panel/barberos/${id}/foto`, { method: 'PUT', body: JSON.stringify({ imagen: await achicar(f, 800, 'image/jpeg') }) })
      onCambio()
    } catch (e) { setMsg(error(e)) } finally { setSubiendo(false); if (input.current) input.current.value = '' }
  }
  async function quitar() { await api(`/panel/barberos/${id}/foto`, { method: 'DELETE' }); onCambio() }
  return (
    <div className="logo-ed" style={{ marginTop: 14 }}>
      <span className="logo-prev">{url ? <img src={url} alt={`Foto de ${nombre}`} /> : <b className="cond">{nombre.slice(0, 2)}</b>}</span>
      <div>
        <div className="botones">
          <button type="button" className="btn sec" onClick={() => input.current?.click()} disabled={subiendo}><ImagePlus className="i" aria-hidden />{subiendo ? 'Subiendo…' : url ? 'Cambiar foto' : 'Subir foto'}</button>
          {url && <button type="button" className="link rojo" onClick={quitar}>Quitar</button>}
        </div>
        {msg && <p className="err" role="alert">{msg}</p>}
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => subir(e.target.files?.[0])} />
      </div>
    </div>
  )
}
