import { FileUp, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { Hoja } from './Agenda'
import { colorOk, PRESETS } from './Vistas'

type Tramo = { dia_semana: number; desde: string; hasta: string }
type Propuesta = {
  barberia: { nombre: string; slug: string; direccion: string; barrio: string; ciudad: string; whatsapp: string; instagram: string; color_acento: string; horas_min_cancelacion: number; descripcion: string }
  admin: { nombre: string; whatsapp: string; usuario: string }
  barberos: { nombre: string; horario_texto: string; horarios: Tramo[]; servicios: string[]; email: string }[]
  servicios: { nombre: string; precio: number; duracion_min: number; quienes: string }[]
  tarjeta: { cada_x_cortes: number; modo: 'fijo' | 'ruleta'; ruleta: { texto: string; descuento_pct: number }[]; premio: string } | null
  ruleta_bienvenida: boolean
  notas: string
  pendientes: string[]
  avisos: string[]
}
export type Creada = { titulo: string; usuario: string; clave: string; id: string; nombre: string }

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'No se pudo.')

/** "Lun a Vie 10:00–18:00 · Sáb 09:00–14:00": los días con el mismo horario, juntos. */
export function resumen(ts: Tramo[]) {
  const porDia = DIAS.map((_, d) => ts.filter((t) => t.dia_semana === d).map((t) => `${t.desde}–${t.hasta}`).join(' y '))
  const grupos: { desde: number; hasta: number; txt: string }[] = []
  porDia.forEach((txt, d) => {
    if (!txt) return
    const g = grupos.at(-1)
    if (g && g.txt === txt && g.hasta === d - 1) g.hasta = d
    else grupos.push({ desde: d, hasta: d, txt })
  })
  return grupos.map((g) => `${DIAS[g.desde]}${g.hasta > g.desde ? ` a ${DIAS[g.hasta]}` : ''} ${g.txt}`).join(' · ') || 'Sin horario'
}

/** Botón "Cargar desde PDF": lee el formulario completado y abre la revisión. */
export function CargarPdf({ onLeido }: { onLeido: (p: Propuesta) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  async function leer(f: File | undefined) {
    if (!f) return
    setLeyendo(true); setError('')
    try {
      const pdf = await new Promise<string>((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = mal; r.readAsDataURL(f) })
      onLeido(await api<Propuesta>('/super/importar-pdf', { method: 'POST', body: JSON.stringify({ pdf }) }))
    } catch (e) { setError(errMsg(e)) } finally { setLeyendo(false); if (input.current) input.current.value = '' }
  }
  return (
    <>
      <button type="button" className="btn sec" onClick={() => input.current?.click()} disabled={leyendo}><FileUp className="i" aria-hidden />{leyendo ? 'Leyendo el PDF…' : 'Cargar desde PDF'}</button>
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => leer(e.target.files?.[0])} />
      {error && <p className="err" role="alert">{error}</p>}
    </>
  )
}

/** Todo lo que vino en el PDF, para revisar y crear de una vez. */
export function AltaDesdePdf({ p, onCerrar, onListo }: { p: Propuesta; onCerrar: () => void; onListo: (c: Creada) => void }) {
  const [b, setB] = useState(p.barberia)
  const [admin, setAdmin] = useState(p.admin)
  const [barberos, setBarberos] = useState(p.barberos)
  const [servicios, setServicios] = useState(p.servicios)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const t = p.tarjeta

  async function crear() {
    if (b.nombre.trim().length < 2 || admin.nombre.trim().length < 2) return setError('Falta el nombre de la barbería o el del dueño.')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.slug)) return setError('El link solo puede tener letras sin tilde, números y guiones.')
    if (!colorOk(b.color_acento)) return setError('Con ese color no se lee bien la página. Elegí otro.')
    setEnviando(true); setError('')
    try {
      const r = await api<{ barberia: { id: string; nombre: string }; admin_usuario: string; clave_temporal: string }>('/super/barberias/completa', {
        method: 'POST',
        body: JSON.stringify({
          ...b, direccion: b.direccion || null, barrio: b.barrio || null, whatsapp: b.whatsapp || null, instagram: b.instagram || null, descripcion: b.descripcion || null,
          admin_nombre: admin.nombre, admin_usuario: admin.usuario,
          servicios: servicios.filter((s) => s.nombre.trim()).map(({ nombre, precio, duracion_min }) => ({ nombre, precio, duracion_min })),
          barberos: barberos.filter((x) => x.nombre.trim()).map(({ nombre, email, horarios, servicios: sv }) => ({ nombre, email: email || null, horarios, servicios: sv })),
          tarjeta: t && (t.modo === 'fijo' || t.ruleta.length >= 2) ? t : null,
          ruleta_bienvenida: p.ruleta_bienvenida,
        }),
      })
      onListo({ titulo: `${r.barberia.nombre} ya está cargada`, usuario: r.admin_usuario, clave: r.clave_temporal, id: r.barberia.id, nombre: r.barberia.nombre })
    } catch (e) { setError(errMsg(e)) } finally { setEnviando(false) }
  }

  const campo = (label: string, v: string, set: (v: string) => void, ayuda?: string) => (
    <label className="campo">{label}<input value={v} onChange={(e) => set(e.target.value)} autoComplete="off" />{ayuda && <span className="ayuda">{ayuda}</span>}</label>
  )
  return (
    <Hoja titulo="Revisar y crear" abierta onCerrar={onCerrar}
      pie={<div className="botones">{error && <p className="err" role="alert">{error}</p>}<button type="button" className="btn" onClick={crear} disabled={enviando}>{enviando ? 'Creando…' : 'Crear todo'}</button></div>}>
      {p.avisos.length > 0 && <div className="confirmar" style={{ marginBottom: 12 }}><b>Revisá esto antes de crear:</b><ul style={{ margin: 0, paddingLeft: 18 }}>{p.avisos.map((a) => <li key={a}>{a}</li>)}</ul></div>}

      <p className="pdf-sec cond">01 · La barbería</p>
      {campo('Nombre de la barbería', b.nombre, (v) => setB({ ...b, nombre: v }))}
      {campo('Link', b.slug, (v) => setB({ ...b, slug: v }), `${location.host}/${b.slug || '…'}`)}
      <div className="fila2">{campo('Dirección', b.direccion, (v) => setB({ ...b, direccion: v }))}{campo('Barrio', b.barrio, (v) => setB({ ...b, barrio: v }))}</div>
      <div className="fila2">{campo('WhatsApp', b.whatsapp, (v) => setB({ ...b, whatsapp: v }))}{campo('Instagram', b.instagram, (v) => setB({ ...b, instagram: v }))}</div>
      <div className="campo">Color de la marca
        <div className="colores" role="group" aria-label="Color de la marca">{PRESETS.map(([c, n]) => <button key={c} type="button" className="color-n" aria-pressed={c === b.color_acento} onClick={() => setB({ ...b, color_acento: c })}><span className="color" style={{ background: c }} aria-hidden />{n}</button>)}
          <label className="btn sec chico elegir-color">Elegir a ojo<input type="color" value={/^#[0-9a-f]{6}$/.test(b.color_acento) ? b.color_acento : '#c9a46a'} onChange={(e) => setB({ ...b, color_acento: e.target.value.toLowerCase() })} /></label></div>
        {!colorOk(b.color_acento) && <span className="err">Con ese color no se lee bien la página.</span>}</div>
      <label className="campo">Descripción<textarea maxLength={600} value={b.descripcion} onChange={(e) => setB({ ...b, descripcion: e.target.value })} /></label>

      <p className="pdf-sec cond">02 · Quién maneja el panel</p>
      <div className="fila2">{campo('Nombre del dueño', admin.nombre, (v) => setAdmin({ ...admin, nombre: v }))}{campo('Usuario', admin.usuario, (v) => setAdmin({ ...admin, usuario: v }))}</div>

      <p className="pdf-sec cond">04 · Barberos ({barberos.length})</p>
      {barberos.map((x, i) => (
        <div key={i} className="bloque" style={{ marginTop: 8 }}>
          <div className="fila2">{campo('Nombre', x.nombre, (v) => setBarberos(barberos.map((y, j) => (j === i ? { ...y, nombre: v } : y))))}{campo('Mail (avisos)', x.email, (v) => setBarberos(barberos.map((y, j) => (j === i ? { ...y, email: v } : y))))}</div>
          <p className="ayuda"><b>Horario:</b> {resumen(x.horarios)}{x.horario_texto && <> · escribió "{x.horario_texto}"</>}. Si no quedó bien, corregilo después en Barberos.</p>
          <div className="checks" role="group" aria-label={`Servicios de ${x.nombre}`}>{servicios.map((s) => (
            <label key={s.nombre} className="check"><input type="checkbox" checked={x.servicios.includes(s.nombre)} onChange={() => setBarberos(barberos.map((y, j) => (j === i ? { ...y, servicios: y.servicios.includes(s.nombre) ? y.servicios.filter((n) => n !== s.nombre) : [...y.servicios, s.nombre] } : y)))} />{s.nombre}</label>))}</div>
        </div>))}

      <p className="pdf-sec cond">05 · Servicios ({servicios.length})</p>
      {servicios.map((s, i) => (
        <div key={i} className="fila2" style={{ alignItems: 'end' }}>
          {campo('Servicio', s.nombre, (v) => setServicios(servicios.map((y, j) => (j === i ? { ...y, nombre: v } : y))))}
          <label className="campo">Precio<input inputMode="numeric" value={s.precio} onChange={(e) => setServicios(servicios.map((y, j) => (j === i ? { ...y, precio: +e.target.value.replace(/\D/g, '') || 0 } : y)))} /></label>
          <label className="campo">Minutos<select value={s.duracion_min} onChange={(e) => setServicios(servicios.map((y, j) => (j === i ? { ...y, duracion_min: +e.target.value } : y)))}>{[15, 20, 30, 40, 45, 60, 75, 90, 120].concat(s.duracion_min).filter((v, k, a) => a.indexOf(v) === k).sort((a2, b2) => a2 - b2).map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
          <button type="button" className="quitar" aria-label={`Quitar ${s.nombre}`} onClick={() => setServicios(servicios.filter((_, j) => j !== i))}><X className="i" aria-hidden /></button>
        </div>))}

      <p className="pdf-sec cond">06 · Tarjeta de cortes</p>
      <p className="ayuda">{!t ? 'No completaron la tarjeta: la cargás después en Mi página.'
        : t.modo === 'ruleta' ? `Cada ${t.cada_x_cortes} cortes, ruleta con: ${t.ruleta.map((r) => `${r.texto} (${r.descuento_pct}%)`).join(', ')}.${p.ruleta_bienvenida ? ' Con ruleta de bienvenida.' : ''}`
          : `Cada ${t.cada_x_cortes} cortes: ${t.premio || 'premio sin escribir'}.`}</p>

      {(p.notas || p.pendientes.length > 0) && <><p className="pdf-sec cond">07 · Algo más</p>
        {p.notas && <p className="ayuda">"{p.notas}" (días libres y bloqueos se cargan en Barberos y en la grilla)</p>}
        {p.pendientes.map((x) => <p key={x} className="ayuda">• {x}</p>)}</>}
    </Hoja>
  )
}
