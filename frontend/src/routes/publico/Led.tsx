/** Display de 7 segmentos (mismo dibujo que el prototipo). El cero de adelante queda apagado. */
const SEG: Record<string, string> = {
  a: 'M14 4h52l-8 8H22z', b: 'M68 6l8 8v42l-8 4-8-8V14z', c: 'M68 64l8 4v42l-8 8-8-8V72z', d: 'M22 112h36l8 8H14z',
  e: 'M12 64l8 8v38l-8 8-8-8V68z', f: 'M12 6l8 8v38l-8 8-8-4V14z', g: 'M20 58h40l6 4-6 4H20l-6-4z',
}
const MAPA = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg']

function Digito({ n }: { n: number | null }) {
  return (
    <svg viewBox="0 0 80 124" aria-hidden className="h-full w-auto overflow-visible">
      {Object.entries(SEG).map(([k, p]) => (
        <path key={k} d={p} className={n !== null && MAPA[n].includes(k) ? 'led-on' : 'led-off'} />
      ))}
    </svg>
  )
}

/** hora = "16:15" o "9:30"; null = sin turnos ("- -:- -") */
export function Led({ hora, className }: { hora: string | null; className?: string }) {
  const [h, m] = hora ? hora.split(':') : ['', '']
  const cifras = hora ? [h.length === 2 ? +h[0] : null, +h.at(-1)!, +m[0], +m[1]] : [null, null, null, null]
  return (
    <span className={`led ${hora ? '' : 'led-vacio'} ${className ?? ''}`} aria-hidden>
      <Digito n={cifras[0]} />
      <Digito n={cifras[1]} />
      <svg viewBox="0 0 16 124" className="h-full w-auto">
        <circle cx="8" cy="42" r="6" className="led-on" />
        <circle cx="8" cy="84" r="6" className="led-on" />
      </svg>
      <Digito n={cifras[2]} />
      <Digito n={cifras[3]} />
    </span>
  )
}
