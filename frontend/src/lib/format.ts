import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/** Zona horaria en la que se muestra todo. En la base se guarda UTC. */
export const ZONA_AR = 'America/Argentina/Buenos_Aires'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** 12500 → "$ 12.500" */
export function formatPrecio(monto: number): string {
  return pesos.format(Math.round(monto))
}

/** Convierte un instante (ISO en UTC o Date) a la hora de Buenos Aires. */
export function enZonaAR(fecha: Date | string): TZDate {
  return new TZDate(new Date(fecha).getTime(), ZONA_AR)
}

/** "14:30" en hora de Buenos Aires. */
export function formatHora(fecha: Date | string): string {
  return format(enZonaAR(fecha), 'HH:mm')
}

/** "martes 21 de octubre" en hora de Buenos Aires. */
export function formatFechaLarga(fecha: Date | string): string {
  return format(enZonaAR(fecha), "EEEE d 'de' MMMM", { locale: es })
}

/** "mar 21" para chips de día. */
export function formatDiaCorto(fecha: Date | string): string {
  return format(enZonaAR(fecha), 'EEE d', { locale: es })
}

/** "45 min" · "1 h" · "1 h 15 min" */
export function formatDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
