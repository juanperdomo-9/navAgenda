import { useQuery, useQueryClient } from '@tanstack/react-query'
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
        <p className="mt-3 text-tinta-2">
          {yo.data.debe_cambiar_clave ? 'Antes de seguir tenés que cambiar tu clave temporal.' : 'Sesión iniciada. Las pantallas del panel llegan en los próximos pasos.'}
        </p>
      </section>
    </main>
  )
}
