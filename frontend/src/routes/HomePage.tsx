import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button, Container } from '@/components/ui'
import { Wordmark } from './Wordmark'

/** Portada provisoria. El portal con buscador y mapa se construye en la tarea 6b. */
export function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <Container className="flex h-20 items-center">
        <Wordmark />
      </Container>
      <Container className="flex flex-1 flex-col justify-center pb-24">
        <h1 className="display max-w-3xl text-5xl leading-[1.04] font-medium text-ivory sm:text-6xl">
          Tu próximo corte, <em className="text-accent">a un toque.</em>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Encontrá barberías cerca tuyo, mirá sus horarios libres y reservá con tu nombre y tu teléfono. Sin cuentas, sin
          vueltas.
        </p>
        <p className="mt-10 text-sm text-subtle">Estamos preparando el portal. Muy pronto vas a poder reservar acá.</p>
        {import.meta.env.DEV && (
          <div className="mt-6">
            <Button asChild variant="secondary">
              <Link to="/dev/design-system">
                Ver sistema de diseño <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        )}
      </Container>
    </main>
  )
}
