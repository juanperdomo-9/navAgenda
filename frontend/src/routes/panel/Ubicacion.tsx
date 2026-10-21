import { useEffect, useRef, useState } from 'react'

const LA_PLATA: [number, number] = [-57.9545, -34.9214]

/** El admin toca el mapa donde está su local (MapLibre + OpenFreeMap). */
export function Ubicacion({ lat, lng, onCambiar }: { lat: string | null; lng: string | null; onCambiar: (lat: string, lng: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const cambiar = useRef(onCambiar)
  cambiar.current = onCambiar
  useEffect(() => {
    let mapa: { remove: () => void } | undefined
    let vivo = true
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([{ default: ml }]) => {
      if (!vivo || !ref.current) return
      const punto: [number, number] | null = lat && lng ? [+lng, +lat] : null
      const m = new ml.Map({ container: ref.current, style: 'https://tiles.openfreemap.org/styles/positron', center: punto ?? LA_PLATA, zoom: punto ? 16 : 13, attributionControl: { compact: true } })
      m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
      const marca = new ml.Marker({ color: '#ff2b1c' })
      if (punto) marca.setLngLat(punto).addTo(m)
      m.on('click', (e) => {
        marca.setLngLat(e.lngLat).addTo(m)
        cambiar.current(e.lngLat.lat.toFixed(6), e.lngLat.lng.toFixed(6))
      })
      mapa = m
    }).catch(() => setError(true))
    return () => { vivo = false; mapa?.remove() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- el mapa se arma una vez; los clics actualizan el punto
  return (
    <div ref={ref} role="region" aria-label="Mapa: tocá donde está tu local" style={{ height: 260, marginTop: 10, overflow: 'hidden', contain: 'inline-size', border: '2px solid var(--linea-fuerte)', background: '#e9e1cf' }}>
      {error && <p style={{ padding: 16 }}>No pudimos cargar el mapa.</p>}
    </div>
  )
}
