import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ExternalLink, LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { api, ApiError, type UsuarioPanel } from '@/lib/api'
import { Agenda } from './Agenda'
import './panel.css'

type Config = { nombre: string; slug: string }

/** Panel de la barbería (diseño: design/panel). Verifica la sesión y muestra la Agenda. */
export function PanelPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const yo = useQuery({ queryKey: ['yo'], queryFn: () => api<UsuarioPanel>('/auth/yo'), retry: false })
  const admin = yo.data?.rol === 'admin' && !yo.data.debe_cambiar_clave
  const cfg = useQuery({ queryKey: ['p-config'], queryFn: () => api<Config>('/panel/barberia'), enabled: admin })

  if (yo.isPending) return <div className="pa"><p style={{ padding: 24 }}>Cargando…</p></div>
  if (yo.error instanceof ApiError && yo.error.status === 401) return <Navigate to="/panel/ingresar" replace />
  if (yo.isError) return <div className="pa"><p role="alert" style={{ padding: 24 }}>{yo.error.message}</p></div>

  async function salir() {
    await api('/auth/salir', { method: 'POST' })
    qc.clear()
    navigate('/panel/ingresar', { replace: true })
  }
  const nombre = cfg.data?.nombre ?? (yo.data.rol === 'superadmin' ? 'NavAgenda' : '')

  return (
    <div className="pa">
      <div className="app">
        <nav className="lado" aria-label="Panel">
          <div className="b"><span>Panel de</span><b className="cond">{nombre}</b></div>
          <a href="/panel" aria-current="page"><CalendarDays className="i" aria-hidden />Agenda</a>
          {cfg.data && <a href={`/${cfg.data.slug}`} target="_blank" rel="noopener"><ExternalLink className="i" aria-hidden />Mi página</a>}
          <a href="#" className="salir" onClick={(e) => { e.preventDefault(); salir() }}><LogOut className="i" aria-hidden />Salir</a>
        </nav>
        <div>
          <header className="cab">
            <b className="nombre cond">{nombre}</b>
            <button type="button" className="ver-pagina" onClick={salir} style={{ background: 'none', cursor: 'pointer' }}>Salir</button>
          </header>
          {yo.data.debe_cambiar_clave ? <CambiarClave nombre={yo.data.nombre} onListo={() => qc.invalidateQueries({ queryKey: ['yo'] })} />
            : admin ? <Agenda />
            : <main><div className="titulo"><h1 className="cond">Hola, {yo.data.nombre.split(' ')[0]}</h1><p>Sos superadmin. Las barberías se crean con la API /super o con los comandos de DEPLOY.md.</p></div></main>}
        </div>
      </div>
    </div>
  )
}

/** Primera entrada con clave temporal: hay que elegir una propia antes de usar el panel. */
function CambiarClave({ nombre, onListo }: { nombre: string; onListo: () => void }) {
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
  return (
    <main>
      <div className="titulo"><h1 className="cond">Hola, {nombre.split(' ')[0]}</h1><p>Entraste con una clave temporal. Elegí una tuya para seguir.</p></div>
      <form onSubmit={enviar} style={{ display: 'grid', gap: 4, maxWidth: 420 }}>
        <label className="campo">Clave temporal<input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" /></label>
        <label className="campo">Clave nueva (mínimo 10 caracteres)<input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></label>
        {error && <p role="alert" className="err">{error}</p>}
        <button type="submit" className="btn" style={{ marginTop: 12 }}>Guardar clave</button>
      </form>
    </main>
  )
}
