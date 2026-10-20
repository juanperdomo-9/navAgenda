import { formatDuracion, formatFechaLarga, formatHora, formatPrecio } from './format'

describe('formatPrecio', () => {
  it('formatea pesos sin decimales con separador de miles', () => {
    expect(formatPrecio(12500).replace(/\s/g, ' ')).toBe('$ 12.500')
    expect(formatPrecio(9999.6).replace(/\s/g, ' ')).toBe('$ 10.000')
  })
})

describe('fechas en hora argentina', () => {
  it('convierte UTC a Buenos Aires (UTC-3)', () => {
    expect(formatHora('2026-10-21T17:30:00Z')).toBe('14:30')
  })
  it('respeta el cambio de día al convertir', () => {
    expect(formatFechaLarga('2026-10-22T01:00:00Z')).toBe('miércoles 21 de octubre')
  })
})

describe('formatDuracion', () => {
  it.each([
    [30, '30 min'],
    [60, '1 h'],
    [75, '1 h 15 min'],
  ])('%i → %s', (min, txt) => expect(formatDuracion(min)).toBe(txt))
})
