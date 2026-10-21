import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { api, ApiError, type UsuarioPanel } from '@/lib/api'

/** Ingreso al panel (admin y superadmin). Diseño: design/panel/ingresar.html */
export function IngresarPage() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    if (!usuario.trim() || !clave) return setError('Completá tu usuario y tu clave.')
    setEnviando(true)
    setError('')
    try {
      await api<UsuarioPanel>('/auth/ingresar', { method: 'POST', body: JSON.stringify({ usuario, clave }) })
      navigate('/panel', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Algo salió mal. Probá de nuevo.')
      setClave('')
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'min-h-13 w-full rounded-md border-2 border-linea-fuerte bg-papel px-3.5 text-[17px] font-semibold text-tinta outline-none focus:border-tinta focus:shadow-[0_0_0_3px_var(--t-roll)]'

  return (
    <main className="grid min-h-dvh place-items-center bg-roll px-4 py-6 font-archivo text-tinta">
      <section aria-labelledby="t" className="relative w-full max-w-100 bg-papel px-6 pb-7">
        <header className="-mx-6 mb-5 flex items-center justify-between bg-pantalla px-6 py-4">
          <b className="cond text-2xl text-roll">NavAgenda</b>
          <span className="text-xs font-bold text-calido">Panel de la barbería</span>
        </header>
        <h1 id="t" className="cond text-[56px] leading-[.85]">Ingresar</h1>
        <p className="mt-2.5 text-[15px] text-tinta-2">Para dueños y encargados. Tus clientes no necesitan cuenta.</p>
        <form onSubmit={entrar} noValidate className="mt-3 grid gap-3">
          <label className="grid gap-1.5 text-sm font-bold">
            Usuario
            <input className={campo} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoCapitalize="off" spellCheck={false} />
          </label>
          <label className="grid gap-1.5 text-sm font-bold">
            Clave
            <span className="flex rounded-md border-2 border-linea-fuerte bg-papel focus-within:border-tinta focus-within:shadow-[0_0_0_3px_var(--t-roll)]">
              <input className="min-h-12 min-w-0 flex-1 bg-transparent px-3.5 text-[17px] font-semibold outline-none" type={ver ? 'text' : 'password'} value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" />
              <button type="button" onClick={() => setVer((v) => !v)} aria-pressed={ver} className="min-h-11 px-3 text-[13px] font-bold underline">
                {ver ? 'Ocultar' : 'Ver'}
              </button>
            </span>
          </label>
          {error && (
            <p role="alert" className="border-2 border-mal bg-mal/5 px-3.5 py-3 text-[15px] font-semibold text-mal">
              {error}
            </p>
          )}
          <button type="submit" disabled={enviando} className="cond mt-2 min-h-13 rounded-md border-2 border-tinta bg-roll text-lg hover:bg-roll-hi disabled:opacity-60">
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <small className="mt-4.5 block text-[13px] text-tinta-2">¿Te olvidaste la clave? Escribile a NavAgenda y te damos una temporal para que la cambies al entrar.</small>
      </section>
    </main>
  )
}
