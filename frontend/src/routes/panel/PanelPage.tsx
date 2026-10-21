import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { api, ApiError, type UsuarioPanel } from '@/lib/api'

/** Entrada del panel: verifica la sesión. Las vistas (Agenda, Barberos, Servicios…) se portan desde design/panel. */
export function PanelPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const yo = useQuery({ queryKey: ['yo'], queryFn: () => api<UsuarioPanel>('/auth/yo'), retry: false })

  if (yo.isPending) return <p className="p-6 font-archivo">Cargando…</p>
  if (yo.error instanceof ApiError && yo.error.status === 401) return <Navigate to="/panel/ingresar" replace />
  if (yo.isError) return <p role="alert" className="p-6 font-archivo text-mal">{yo.error.message}</p>

  async function salir() {
    await api('/auth/salir', { method: 'POST' })
    qc.removeQueries({ queryKey: ['yo'] })
    navigate('/panel/ingresar', { replace: true })
  }

  return (
    <main className="min-h-dvh bg-fondo font-archivo text-tinta">
      <header className="flex items-center justify-between bg-pantalla px-5 py-3 text-calido">
        <b className="cond text-2xl text-roll">Panel</b>
        <button type="button" onClick={salir} className="min-h-11 rounded-md border border-[#96503f] px-3.5 text-sm font-bold text-[#f3e9dc]">
          Salir
        </button>
      </header>
      <section className="p-6">
        <h1 className="cond text-6xl leading-[.85]">Hola, {yo.data.nombre.split(' ')[0]}</h1>
        {yo.data.debe_cambiar_clave ? <CambiarClave onListo={() => qc.invalidateQueries({ queryKey: ['yo'] })} /> : (
          <p className="mt-3 text-tinta-2">Sesión iniciada.</p>
        )}
      </section>
    </main>
  )
}

/** Primera entrada con clave temporal: hay que elegir una propia antes de usar el panel. */
function CambiarClave({ onListo }: { onListo: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState('')
  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (nueva.length < 10) return setError('La clave nueva tiene que tener al menos 10 caracteres.')
    try {
      await api('/auth/cambiar-clave', { method: 'POST', body: JSON.stringify({ clave_actual: actual, clave_nueva: nueva }) })
      onListo()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos cambiar la clave.')
    }
  }
  const campo = 'min-h-13 rounded-md border-2 border-linea-fuerte bg-papel px-3.5 text-[17px] font-semibold outline-none focus:border-tinta'
  return (
    <form onSubmit={enviar} className="mt-5 grid max-w-100 gap-3">
      <p className="text-tinta-2">Entraste con una clave temporal. Elegí una tuya para seguir.</p>
      <label className="grid gap-1.5 text-sm font-bold">Clave temporal<input className={campo} type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" /></label>
      <label className="grid gap-1.5 text-sm font-bold">Clave nueva (mínimo 10 caracteres)<input className={campo} type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></label>
      {error && <p role="alert" className="font-semibold text-mal">{error}</p>}
      <button type="submit" className="cond min-h-13 rounded-md border-2 border-tinta bg-roll text-lg">Guardar clave</button>
    </form>
  )
}
