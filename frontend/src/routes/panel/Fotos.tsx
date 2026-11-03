import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Film, ImagePlus, X } from 'lucide-react'
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

/** Videos del local (hasta 2, 15 MB): suben directo del celular a Supabase con una URL firmada. */
export function VideosLocal({ onAviso }: { onAviso: (m: string) => void }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['p-videos'], queryFn: () => api<{ habilitado: boolean; videos: { id: string; url: string }[] }>('/panel/videos') })
  const input = useRef<HTMLInputElement>(null)
  const [avance, setAvance] = useState<number | null>(null)
  if (!q.data?.habilitado) return null
  const lista = q.data.videos
  async function subir(f: File | undefined) {
    if (!f) return
    if (f.size > 15 * 1024 * 1024) { onAviso('Ese video pesa más de 15 MB. Mandá uno más corto (unos 20 segundos).'); return }
    setAvance(0)
    try {
      const { ruta, subir_url } = await api<{ ruta: string; subir_url: string }>('/panel/videos/subida', { method: 'POST', body: JSON.stringify({ tipo: f.type || 'video/mp4', bytes: f.size }) })
      await new Promise<void>((ok, mal) => {
        const x = new XMLHttpRequest()
        x.open('PUT', subir_url)
        x.setRequestHeader('content-type', f.type || 'video/mp4')
        x.upload.onprogress = (e) => e.lengthComputable && setAvance(Math.round((e.loaded / e.total) * 100))
        x.onload = () => (x.status < 300 ? ok() : mal(new Error('subida')))
        x.onerror = () => mal(new Error('subida'))
        x.send(f)
      })
      await api('/panel/videos', { method: 'POST', body: JSON.stringify({ ruta }) })
      onAviso('Video agregado a tu página.')
    } catch (e) { onAviso(e instanceof ApiError ? e.message : 'No se pudo subir el video. Probá con otra conexión.') } finally {
      setAvance(null); if (input.current) input.current.value = ''
      qc.invalidateQueries({ queryKey: ['p-videos'] })
    }
  }
  async function borrar(id: string) { await api(`/panel/videos/${id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['p-videos'] }) }
  return (
    <section className="bloque"><h3 className="cond">Videos del local <small>{lista.length}/2</small></h3>
      <p className="ayuda" style={{ marginTop: 10 }}>Cortos (hasta 15 MB, unos 20 segundos). Se ven en la galería de tu página, sin sonido hasta que los tocan.</p>
      <ul className="fotos-ed">
        {lista.map((v, i) => <li key={v.id}><video src={v.url} muted playsInline preload="metadata" /><button type="button" onClick={() => borrar(v.id)} aria-label={`Borrar el video ${i + 1}`}><X aria-hidden /></button></li>)}
        {lista.length < 2 && <li><button type="button" className="fotos-mas" onClick={() => input.current?.click()} disabled={avance !== null}><Film aria-hidden />{avance !== null ? `Subiendo ${avance}%` : 'Agregar'}</button></li>}
      </ul>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => subir(e.target.files?.[0])} />
    </section>
  )
}
