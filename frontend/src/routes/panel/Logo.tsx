import { ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api'

/** Achica la foto en el navegador (las del celular pesan mucho) antes de subirla. */
function achicar(archivo: File): Promise<string> {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      const lado = Math.min(1000, img.width, img.height) || 1000
      const k = lado / Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      ok(c.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('imagen')) }
    img.src = url
  })
}

/** Logo de la barbería: se ve en su página, en el portal y en la foto del link al compartir. */
export function Logo({ url, nombre, onCambio }: { url: string | null; nombre: string; onCambio: (msg: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  async function subir(f: File | undefined) {
    if (!f) return
    setSubiendo(true)
    try {
      await api('/panel/barberia/logo', { method: 'PUT', body: JSON.stringify({ imagen: await achicar(f) }) })
      onCambio('Logo actualizado en tu página.')
    } catch (e) {
      onCambio(e instanceof ApiError ? e.message : 'No pudimos subir esa imagen. Probá con un JPG o PNG.')
    } finally { setSubiendo(false); if (input.current) input.current.value = '' }
  }
  async function quitar() {
    await api('/panel/barberia/logo', { method: 'DELETE' })
    onCambio('Sacamos el logo.')
  }
  return (
    <section className="bloque"><h3 className="cond">Logo</h3>
      <div className="logo-ed">
        <span className="logo-prev">{url ? <img src={url} alt={`Logo de ${nombre}`} /> : <b className="cond">{nombre.slice(0, 2)}</b>}</span>
        <div>
          <p className="ayuda">Cuadrado o redondo queda mejor. Se ve en tu página, en el portal y en la foto cuando compartís tu link.</p>
          <div className="botones" style={{ marginTop: 10 }}>
            <button type="button" className="btn sec" onClick={() => input.current?.click()} disabled={subiendo}><ImagePlus className="i" aria-hidden />{subiendo ? 'Subiendo…' : url ? 'Cambiar logo' : 'Subir logo'}</button>
            {url && <button type="button" className="link rojo" onClick={quitar}>Quitar</button>}
          </div>
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => subir(e.target.files?.[0])} />
        </div>
      </div>
    </section>
  )
}
