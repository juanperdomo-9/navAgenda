// Después de `vite build`: etiquetas para compartir links (WhatsApp, Instagram, etc.).
// Los que leen el link no ejecutan JavaScript, así que cada barbería necesita su propio HTML con
// su título, su descripción y su foto (la dibuja la API en /og/<slug>.png).
// Si la API no responde, queda solo la general: el build no falla.
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const SITIO = (process.env.SITIO_URL || 'https://navagenda-web.onrender.com').replace(/\/$/, '')
const API = (process.env.API_URL || 'https://navagenda-api.onrender.com').replace(/\/$/, '')
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function etiquetas({ titulo, descripcion, imagen, url }) {
  return `<!--og-->
    <meta name="description" content="${esc(descripcion)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="NavAgenda" />
    <meta property="og:locale" content="es_AR" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:title" content="${esc(titulo)}" />
    <meta property="og:description" content="${esc(descripcion)}" />
    <meta property="og:image" content="${esc(imagen)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <!--/og-->`
}
const armar = (html, m) =>
  html.replace(/<!--og[\s\S]*?<!--\/og-->/, etiquetas(m)).replace(/<title>.*?<\/title>/, `<title>${esc(m.titulo)}</title>`)

const base = await readFile('dist/index.html', 'utf8')
await writeFile('dist/index.html', armar(base, {
  titulo: 'NavAgenda · Sacá número',
  descripcion: 'Sacá turno en barberías de La Plata. Sin fila, sin cuenta, sin seña.',
  imagen: `${SITIO}/api/og.png`,
  url: `${SITIO}/`,
}))

try {
  const r = await fetch(`${API}/p`, { signal: AbortSignal.timeout(120_000) })
  const barberias = await r.json()
  for (const b of barberias) {
    const lugar = [b.direccion, b.barrio].filter(Boolean).join(' · ')
    const html = armar(base, {
      titulo: `${b.nombre} · Sacá turno`,
      descripcion: `${lugar ? lugar + '. ' : ''}Sacá turno online con tu barbero: sin fila, sin cuenta, sin seña.`,
      imagen: `${SITIO}/api/og/${b.slug}.png`,
      url: `${SITIO}/${b.slug}`,
    })
    await mkdir(`dist/${b.slug}`, { recursive: true })
    await writeFile(`dist/${b.slug}/index.html`, html)
  }
  console.log(`compartir: ${barberias.length} barberías con su foto`)
} catch (e) {
  console.warn('compartir: sin la API, quedan solo las etiquetas generales', e.message)
}
