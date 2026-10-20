import { lazy, Suspense } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { Spinner } from '@/components/ui'
import { HomePage } from '@/routes/HomePage'
import { NotFoundPage } from '@/routes/NotFoundPage'

function Cargando() {
  return (
    <div className="grid min-h-dvh place-items-center text-accent">
      <Spinner className="size-6" />
    </div>
  )
}

const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  // Próximas tareas: /buscar, /b/:slug, /turno/:token, /admin, /super
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
