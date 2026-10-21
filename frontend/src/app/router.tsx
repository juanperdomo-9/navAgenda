import { lazy, Suspense } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { Spinner } from '@/components/ui'
import { HomePage } from '@/routes/HomePage'
import { NotFoundPage } from '@/routes/NotFoundPage'
import { IngresarPage } from '@/routes/panel/IngresarPage'
import { PanelPage } from '@/routes/panel/PanelPage'
import { BarberiaPage } from '@/routes/publico/BarberiaPage'
import { TicketPage } from '@/routes/publico/TicketPage'

function Cargando() {
  return (
    <div className="grid min-h-dvh place-items-center text-accent">
      <Spinner className="size-6" />
    </div>
  )
}

const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/panel/ingresar', element: <IngresarPage /> },
  { path: '/panel', element: <PanelPage /> },
  // Próximas tareas: /:slug (página de la barbería), /t/:token (ticket), vistas del panel, /super
  { path: '/t/:token', element: <TicketPage /> },
  // La página de cada barbería vive en la raíz: navagenda.com.ar/inspirationmen
  { path: '/:slug', element: <BarberiaPage /> },
  { path: '*', element: <NotFoundPage /> },
]

// La muestra del sistema de diseño solo existe en desarrollo.
if (import.meta.env.DEV) {
  const DesignSystemPage = lazy(() => import('@/routes/dev/DesignSystemPage'))
  routes.unshift({
    path: '/dev/design-system',
    element: (
      <Suspense fallback={<Cargando />}>
        <DesignSystemPage />
      </Suspense>
    ),
  })
}

export const router = createBrowserRouter(routes)
