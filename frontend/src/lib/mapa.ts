/** MapLibre con tiles de OpenFreeMap (gratis, sin API key). Se carga solo cuando hay un mapa en pantalla. */
export const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron'
export const LA_PLATA: [number, number] = [-57.9545, -34.9214]

export const cargarMapLibre = () =>
  Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([m]) => m.default)
