import { ACENTOS_PRESET, chequearAcento, contraste, normalizarHex } from './contrast'

describe('contraste', () => {
  it('blanco sobre negro es 21:1', () => {
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 0)
  })
})

describe('chequearAcento', () => {
  it('los presets pasan AA', () => {
    expect(chequearAcento(ACENTOS_PRESET.dorado).valido).toBe(true)
    expect(chequearAcento(ACENTOS_PRESET.cobre).valido).toBe(true)
  })
  it('un acento muy oscuro no pasa', () => {
    expect(chequearAcento('#3a2a10').valido).toBe(false)
  })
})

describe('normalizarHex', () => {
  it('acepta con o sin # y normaliza a minúsculas', () => {
    expect(normalizarHex('C9A46A')).toBe('#c9a46a')
    expect(normalizarHex(' #ABCDEF ')).toBe('#abcdef')
  })
  it('rechaza valores inválidos', () => {
    expect(normalizarHex('#abc')).toBeNull()
    expect(normalizarHex('dorado')).toBeNull()
  })
})
