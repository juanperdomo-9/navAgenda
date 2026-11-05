import { Star, Video } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api'

export type OpinionPublica = { id: string; nombre: string; estrellas: number; texto: string | null; video_url: string | null; barbero: string; servicio: string; fecha: string }
export type ResumenOpiniones = { cantidad: number; promedio: number | null; lista: OpinionPublica[] }

const ETIQUETAS = ['', 'Malo', 'Flojo', 'Bien', 'Muy bien', 'Excelente']

/** Estrellas para mostrar (no se tocan). */
export function Estrellas({ n, tam = 18 }: { n: number; tam?: number }) {
  return (
    <span className="op-estrellas" role="img" aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} aria-hidden width={tam} height={tam} className={i <= Math.round(n) ? 'llena' : ''} />)}
    </span>
  )
}

/** En el ticket, después del corte: estrellas, comentario y (si se puede) un video corto. */
export function Opinar({ token, videos, onListo }: { token: string; videos: boolean; onListo: () => void }) {
  const [estrellas, setEstrellas] = useState(0)
  const [texto, setTexto] = useState('')
  const [video, setVideo] = useState<File | null>(null)
  const [avance, setAvance] = useState<number | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function enviar() {
    if (!estrellas) return setError('Tocá las estrellas: de 1 a 5.')
    setError('')
    try {
      let video_ruta: string | null = null
      if (video) {
        if (video.size > 15 * 1024 * 1024) return setError('El video pesa más de 15 MB. Grabá uno más corto (unos 20 segundos).')
        setAvance(0)
        const { ruta, subir_url } = await api<{ ruta: string; subir_url: string }>(`/t/${token}/opinion/video`, { method: 'POST', body: JSON.stringify({ tipo: video.type || 'video/mp4', bytes: video.size }) })
        await new Promise<void>((ok, mal) => {
          const x = new XMLHttpRequest()
          x.open('PUT', subir_url)
          x.setRequestHeader('content-type', video.type || 'video/mp4')
          x.upload.onprogress = (e) => e.lengthComputable && setAvance(Math.round((e.loaded / e.total) * 100))
          x.onload = () => (x.status < 300 ? ok() : mal(new Error('subida')))
          x.onerror = () => mal(new Error('subida'))
          x.send(video)
        })
        video_ruta = ruta
      }
      await api(`/t/${token}/opinion`, { method: 'POST', body: JSON.stringify({ estrellas, texto: texto.trim() || null, video_ruta }) })
      onListo()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos guardar tu opinión. Probá de nuevo.')
    } finally { setAvance(null) }
  }

  return (
    <section className="op-form" aria-labelledby="op-tit">
      <h2 id="op-tit" className="cond">¿Cómo te fue?</h2>
      <div className="op-elegir" role="radiogroup" aria-label="Tu puntaje">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={estrellas === i} aria-label={`${i} ${i === 1 ? 'estrella' : 'estrellas'}: ${ETIQUETAS[i]}`}
            className={i <= estrellas ? 'llena' : ''} onClick={() => setEstrellas(i)}><Star aria-hidden /></button>
        ))}
      </div>
      <p className="op-etiqueta" aria-live="polite">{ETIQUETAS[estrellas] || 'Tocá las estrellas'}</p>
      <label className="op-campo">Contalo en una línea (opcional)
        <textarea maxLength={280} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: Impecable el corte, muy buena onda." /></label>
      {videos && (
        <div className="op-video">
          <button type="button" onClick={() => input.current?.click()}><Video aria-hidden />{video ? 'Cambiar video' : 'Sumar un video corto (opcional)'}</button>
          {video && <span>{video.name} · {(video.size / 1024 / 1024).toFixed(1)} MB</span>}
          <input ref={input} type="file" accept="video/*" capture="user" hidden onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
        </div>
      )}
      {error && <p className="op-error" role="alert">{error}</p>}
      <button type="button" className="op-enviar" onClick={enviar} disabled={avance !== null}>{avance !== null ? `Subiendo video ${avance}%` : 'Enviar mi opinión'}</button>
    </section>
  )
}

/** Página de la barbería: promedio y opiniones como talones de ticket. */
export function LoQueDicen({ r }: { r?: ResumenOpiniones }) {
  if (!r || !r.cantidad) return null
  return (
    <section className="sec opiniones" aria-labelledby="op-h">
      <div>
        <h2 className="sec-h" id="op-h">Lo que dicen</h2>
        <p className="op-prom"><b>{r.promedio?.toLocaleString('es-AR')}</b><Estrellas n={r.promedio ?? 0} tam={26} /><span>{r.cantidad} {r.cantidad === 1 ? 'opinión' : 'opiniones'} de clientes que fueron</span></p>
      </div>
      <ul className="op-talones">
        {r.lista.map((o) => (
          <li key={o.id} className="op-talon">
            {o.video_url && <video src={o.video_url} controls playsInline preload="metadata" aria-label={`Video de ${o.nombre}`} />}
            <Estrellas n={o.estrellas} />
            {o.texto && <p>“{o.texto}”</p>}
            <small>{o.nombre} · {o.servicio.toLowerCase()} con {o.barbero}</small>
          </li>
        ))}
      </ul>
    </section>
  )
}
