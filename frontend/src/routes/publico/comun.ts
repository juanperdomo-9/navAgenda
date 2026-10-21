import type { CSSProperties } from 'react'

export const ZONA = 'America/Argentina/Buenos_Aires'
export const pesos = (n: number) => '$ ' + n.toLocaleString('es-AR')
export const horaAR = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA })
export const hoyMas = (dias: number) => new Date(Date.now() + dias * 864e5).toLocaleDateString('en-CA', { timeZone: ZONA })
export const fechaLarga = (iso: string) => {
  const t = new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA }).replace(',', '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const tinta = (hex: string) => ((lum(hex) + 0.05) / (lum('#141210') + 0.05) >= (lum('#fffdf3') + 0.05) / (lum(hex) + 0.05) ? '#141210' : '#fffdf3')

/** Variables CSS del color de la barbería: su "rollo", la tinta que contrasta y la versión que se ve sobre el display. */
export function estiloBarberia(hex: string): CSSProperties {
  let sc = hex
  for (let t = 0.05; (lum(sc) + 0.05) / (lum('#120c0b') + 0.05) < 3 && t < 0.95; t += 0.05) {
    sc = '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + 255 * t).toString(16).padStart(2, '0')).join('')
  }
  return { '--shop': hex, '--on-shop': tinta(hex), '--shop-screen': sc, '--on-shop-screen': tinta(sc) } as CSSProperties
}

/** Tickets sacados desde este dispositivo, para "Mis turnos". */
export function guardarTicket(token: string) {
  try {
    const l = JSON.parse(localStorage.getItem('navagenda-turnos') || '[]') as string[]
    localStorage.setItem('navagenda-turnos', JSON.stringify([token, ...l.filter((x) => x !== token)].slice(0, 20)))
  } catch {
    /* sin almacenamiento: el link igual funciona */
  }
}
