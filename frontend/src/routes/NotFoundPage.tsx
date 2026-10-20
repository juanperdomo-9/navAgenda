import { Link } from 'react-router'
import { Button, Container } from '@/components/ui'
import { Wordmark } from './Wordmark'

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <Container className="flex h-20 items-center">
        <Wordmark />
      </Container>
      <Container size="sm" className="flex flex-1 flex-col items-start justify-center pb-24">
        <p className="display tabular text-6xl font-medium text-accent">404</p>
        <h1 className="display mt-4 text-4xl font-medium text-ivory">Esta página no existe</h1>
        <p className="mt-3 text-lg text-muted">Puede que el link esté mal escrito o que la página se haya movido.</p>
        <Button asChild className="mt-8">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </Container>
    </main>
  )
}
