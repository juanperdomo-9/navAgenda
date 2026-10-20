/** Utilidades de contraste WCAG para validar el color de acento de cada barbería. */

const HEX = /^#?([0-9a-f]{6})$/i

export function normalizarHex(valor: string): string | null {
  const m = HEX.exec(valor.trim())
  return m ? `#${m[1].toLowerCase()}` : null
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Superficies sobre las que se usa el acento como texto o borde. */
const FONDOS = ['#0e0d0c', '#171614', '#1f1e1b']
const TEXTO_OSCURO = '#1a1408'

export type ChequeoAcento = {
  valido: boolean
  /** Peor contraste del acento contra los fondos de la app. */
  sobreFondo: number
  /** Contraste del texto oscuro sobre el acento (botón primario). */
  textoEncima: number
}

/** Un acento es válido si pasa AA (4.5:1) como texto sobre las superficies y con texto oscuro encima. */
export function chequearAcento(hex: string): ChequeoAcento {
  const sobreFondo = Math.min(...FONDOS.map((f) => contraste(hex, f)))
  const textoEncima = contraste(TEXTO_OSCURO, hex)
  return { valido: sobreFondo >= 4.5 && textoEncima >= 4.5, sobreFondo, textoEncima }
}

export const ACENTOS_PRESET = {
  dorado: '#c9a46a',
  cobre: '#c47f57',
} as const
