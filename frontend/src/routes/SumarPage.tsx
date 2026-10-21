import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, ApiError } from '@/lib/api'
import { Pie } from './HomePage'
import './publico/barberia.css'
import './portal.css'

/** "Quiero sumar mi barbería": el pedido le llega al superadmin, que la da de alta. */
export function SumarPage() {
  const [f, setF] = useState({ barberia: '', nombre: '', telefono: '', barrio: '', mensaje: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (f.barberia.trim().length < 2 || f.nombre.trim().length < 2) return setError('Contanos cómo se llama la barbería y cómo te llamás vos.')
    if (f.telefono.replace(/\D/g, '').length < 10) return setError('Revisá el teléfono: con código de área, sin 0 ni 15. Ej.: 221 456 7890.')
    setEnviando(true); setError('')
    try {
      await api('/p/solicitudes', { method: 'POST', body: JSON.stringify({ ...f, barrio: f.barrio || null, mensaje: f.mensaje || null }) })
      setListo(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos mandar tu pedido. Probá de nuevo.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="portal">
      <header className="pb-bar"><Link to="/" className="logo cond" style={{ color: 'inherit', textDecoration: 'none' }}><span className="mark">Nº</span> NavAgenda</Link><Link className="mis" to="/panel/ingresar">Ya tengo cuenta</Link></header>
      <main className="sumar-pag">
        <div>
          <h1 className="cond">Sumá tu<br />barbería.</h1>
          <ul className="sumar-lista">
            <li>Tu link para Instagram y WhatsApp: tus clientes sacan turno solos, con el barbero que quieran.</li>
            <li>La grilla de cada barbero en el celular, con Asistió / No vino.</li>
            <li>La tarjeta de cortes: cada X cortes, el premio que elijas.</li>
            <li>Tus números del día, la semana y el mes.</li>
          </ul>
        </div>
        {listo ? (
          <section className="sumar-form" role="status">
            <h2 className="cond">¡Listo!</h2>
            <p>Nos llegó tu pedido. Te escribimos al {f.telefono} para dejar {f.barberia} andando.</p>
            <Link className="take" to="/">Volver al inicio <ArrowRight aria-hidden /></Link>
          </section>
        ) : (
          <form className="sumar-form" onSubmit={enviar} noValidate>
            <label>Nombre de la barbería<input value={f.barberia} onChange={set('barberia')} autoComplete="organization" maxLength={80} /></label>
            <label>Tu nombre<input value={f.nombre} onChange={set('nombre')} autoComplete="name" maxLength={60} /></label>
            <label>Tu teléfono (WhatsApp)<input type="tel" inputMode="tel" value={f.telefono} onChange={set('telefono')} autoComplete="tel-national" placeholder="221 456 7890" maxLength={24} /></label>
            <label>Barrio <span>(opcional)</span><input value={f.barrio} onChange={set('barrio')} maxLength={80} /></label>
            <label>¿Algo más? <span>(opcional)</span><textarea value={f.mensaje} onChange={set('mensaje')} rows={3} maxLength={500} placeholder="Cuántos barberos son, horarios, lo que quieras." /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" className="take" disabled={enviando}>{enviando ? 'Mandando…' : 'Quiero sumarla'} <ArrowRight aria-hidden /></button>
            <p className="fine">Te escribimos nosotros. No hace falta pagar nada para que te contactemos.</p>
          </form>
        )}
      </main>
      <Pie />
    </div>
  )
}
