/** Cliente de la API. En desarrollo Vite pasa /api al backend; la sesión viaja en una cookie httpOnly. */
const BASE = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function api<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + ruta, {
      ...opciones,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...opciones.headers },
    })
  } catch {
    throw new ApiError(0, 'No pudimos conectarnos. Revisá tu internet y probá de nuevo.')
  }
  if (res.status === 204) return undefined as T
  const datos = await res.json().catch(() => null)
  if (!res.ok) {
    const detalle = datos?.detail
    const msg = typeof detalle === 'string' ? detalle : 'Algo salió mal. Probá de nuevo en un rato.'
    throw new ApiError(res.status, msg)
  }
  return datos as T
}

export type UsuarioPanel = {
  id: string
  nombre: string
  usuario: string
  rol: 'admin' | 'superadmin'
  barberia_id: string | null
  debe_cambiar_clave: boolean
}
