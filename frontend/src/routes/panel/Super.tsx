import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, ApiError } from '@/lib/api'
import { Hoja } from './Agenda'

type Admin = { id: string; nombre: string; usuario: string; ultimo_ingreso: string | null; debe_cambiar_clave: boolean }
type Barberia = { id: string; nombre: string; slug: string; barrio: string | null; activa: boolean; admins: Admin[]; barberos: number }
type Clave = { titulo: string; usuario: string; clave: string }

const aSlug = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const cuando = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }) : 'nunca')
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'No se pudo guardar.')

/** Panel del superadmin: barberías, alta con su admin, reseteo de clave y pausa. */
export function Super() {
  const qc = useQueryClient()
  const bs = useQuery({ queryKey: ['s-barberias'], queryFn: () => api<Barberia[]>('/super/barberias') })
  const [nueva, setNueva] = useState(false)
  const [clave, setClave] = useState<Clave | null>(null)
  const [aviso, setAviso] = useState('')
  const refrescar = () => qc.invalidateQueries({ queryKey: ['s-barberias'] })

  async function resetear(b: Barberia, a: Admin) {
    try {
      const r = await api<{ usuario: string; clave_temporal: string }>(`/super/usuarios/${a.id}/resetear-clave`, { method: 'POST' })
      setClave({ titulo: `Clave nueva para ${b.nombre}`, usuario: r.usuario, clave: r.clave_temporal })
      refrescar()
    } catch (e) { setAviso(errMsg(e)) }
  }
  async function pausar(b: Barberia) {
    try {
      await api(`/super/barberias/${b.id}`, { method: 'PATCH', body: JSON.stringify({ activa: !b.activa }) })
      setAviso(b.activa ? `${b.nombre} quedó pausada: no aparece en el portal y su link no abre.` : `${b.nombre} volvió a estar online.`)
      refrescar()
    } catch (e) { setAviso(errMsg(e)) }
  }

  const ls = bs.data ?? []
  return (
    <main>
      <div className="titulo"><h1 className="cond">Barberías</h1>
        <p>{ls.length ? `${ls.filter((b) => b.activa).length} online de ${ls.length}.` : ''} Cada una tiene su admin, que entra con usuario y clave.</p></div>
      <button type="button" className="btn" onClick={() => { setNueva(true); setClave(null) }}><Plus className="i" aria-hidden />Nueva barbería</button>
      {clave && <ClaveTemporal {...clave} onCerrar={() => setClave(null)} />}
      {aviso && <p role="status" className="vacio" style={{ padding: 12, marginTop: 14 }}>{aviso}</p>}
      {bs.isPending ? <p style={{ marginTop: 16 }}>Cargando…</p> : bs.isError ? <p role="alert" className="err">{bs.error.message}</p>
        : <ul className="lista">{ls.map((b) => (
          <li key={b.id} className={`cliente ${b.activa ? '' : 'bloq'}`}>
            <span><span className="n cond">{b.nombre}</span>
              <span className="r" style={{ display: 'block' }}>/{b.slug}{b.barrio ? ` · ${b.barrio}` : ''} · {b.barberos} {b.barberos === 1 ? 'barbero' : 'barberos'}{b.activa ? '' : ' · pausada'}</span>
              {b.admins.map((a) => <span key={a.id} className="r" style={{ display: 'block' }}>Admin: <b>{a.usuario}</b> ({a.nombre}) · {a.debe_cambiar_clave ? 'todavía no eligió su clave' : `entró ${cuando(a.ultimo_ingreso)}`}</span>)}</span>
            <a className="link" href={`/${b.slug}`} target="_blank" rel="noopener" aria-label={`Ver la página de ${b.nombre}`}><ExternalLink className="i" aria-hidden /></a>
            <span className="acc" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
              {b.admins.map((a) => <button key={a.id} className="link" type="button" onClick={() => resetear(b, a)}>Resetear clave{b.admins.length > 1 ? ` de ${a.usuario}` : ''}</button>)}
              <button className={`link ${b.activa ? 'rojo' : ''}`} type="button" onClick={() => pausar(b)}>{b.activa ? 'Pausar' : 'Reactivar'}</button>
            </span>
          </li>))}</ul>}
      {nueva && <NuevaBarberia onCerrar={() => setNueva(false)} onListo={(c) => { setNueva(false); setClave(c); refrescar() }} />}
    </main>
  )
}

/** La clave temporal se ve una sola vez: hay que pasársela al dueño. */
function ClaveTemporal({ titulo, usuario, clave, onCerrar }: Clave & { onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const texto = `Usuario: ${usuario}\nClave temporal: ${clave}\nEntrá en ${location.origin}/panel/ingresar y elegí tu clave.`
  return (
    <section className="facturado" role="status" style={{ marginTop: 18 }}>
      <small>{titulo}</small>
      <p style={{ font: '700 18px Archivo', color: 'var(--paper, #fffdf3)' }}>Usuario <b>{usuario}</b> · Clave <b style={{ color: 'var(--led)', fontFamily: 'ui-monospace, monospace', letterSpacing: '.04em' }}>{clave}</b></p>
      <p>Se muestra una sola vez. Pasásela al dueño: al entrar tiene que elegir una propia.</p>
      <p style={{ display: 'flex', gap: 18 }}>
        <button type="button" className="link" style={{ color: 'inherit' }} onClick={() => navigator.clipboard?.writeText(texto).then(() => setCopiado(true))}><Copy className="i" aria-hidden />{copiado ? 'Copiado' : 'Copiar para mandar'}</button>
        <button type="button" className="link" style={{ color: 'inherit' }} onClick={onCerrar}>Listo, ya la pasé</button>
      </p>
    </section>
  )
}

function NuevaBarberia({ onCerrar, onListo }: { onCerrar: () => void; onListo: (c: Clave) => void }) {
  const [f, setF] = useState({ nombre: '', slug: '', direccion: '', barrio: '', admin_nombre: '', admin_usuario: '' })
  const [tocado, setTocado] = useState({ slug: false, admin_usuario: false })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF((x) => {
    const n = { ...x, [k]: v }
    if (k === 'nombre') { if (!tocado.slug) n.slug = aSlug(v); if (!tocado.admin_usuario) n.admin_usuario = aSlug(v) }
    return n
  })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (f.nombre.trim().length < 2 || f.admin_nombre.trim().length < 2) return setError('Completá el nombre de la barbería y el del dueño.')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)) return setError('El link solo puede tener letras sin tilde, números y guiones.')
    setEnviando(true)
    try {
      const r = await api<{ barberia: { nombre: string }; admin_usuario: string; clave_temporal: string }>('/super/barberias', {
        method: 'POST',
        body: JSON.stringify({ ...f, direccion: f.direccion || null, barrio: f.barrio || null, ciudad: 'La Plata' }),
      })
      onListo({ titulo: `${r.barberia.nombre} ya está creada`, usuario: r.admin_usuario, clave: r.clave_temporal })
    } catch (err) { setError(errMsg(err)) } finally { setEnviando(false) }
  }

  const campo = (k: keyof typeof f, label: string, extra?: { ayuda?: string; auto?: 'slug' | 'admin_usuario' }) => (
    <label className="campo">{label}
      <input value={f[k]} onChange={(e) => { if (extra?.auto) setTocado((t) => ({ ...t, [extra.auto!]: true })); set(k, e.target.value) }} autoComplete="off" />
      {extra?.ayuda && <span className="ayuda">{extra.ayuda}</span>}
    </label>
  )
  return (
    <Hoja titulo="Nueva barbería" abierta onCerrar={onCerrar}
      pie={<button type="submit" form="nueva-b" className="btn" disabled={enviando}>{enviando ? 'Creando…' : 'Crear barbería'}</button>}>
      <form id="nueva-b" onSubmit={enviar} style={{ display: 'grid', gap: 4 }}>
        {campo('nombre', 'Nombre')}
        {campo('slug', 'Link', { ayuda: `navagenda.com.ar/${f.slug || '…'}`, auto: 'slug' })}
        {campo('direccion', 'Dirección (opcional)', { ayuda: 'Ej.: Calle 8 e/ 49 y 50' })}
        {campo('barrio', 'Barrio (opcional)')}
        {campo('admin_nombre', 'Nombre del dueño')}
        {campo('admin_usuario', 'Usuario del dueño', { ayuda: 'Con este usuario entra al panel.', auto: 'admin_usuario' })}
        {error && <p role="alert" className="err">{error}</p>}
      </form>
    </Hoja>
  )
}
