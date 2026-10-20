import {
  CalendarX2,
  CircleCheck,
  Download,
  Plus,
  Scissors,
  Settings2,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { BarberiaCard, type BarberiaResumen } from '@/components/domain/BarberiaCard'
import { MapPin } from '@/components/domain/MapPin'
import { SearchBar, type Busqueda } from '@/components/domain/SearchBar'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Container,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  MetricCard,
  PasswordInput,
  Popover,
  Price,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  SkeletonGroup,
  StatusPill,
  Stepper,
  Switch,
  Tab,
  Tabs,
  TabsContent,
  TabsList,
  Textarea,
  TimeSlot,
  Tooltip,
  useToast,
  type EstadoTurno,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatPrecio } from '@/lib/format'
import { AccentScope } from '@/theme/AccentScope'
import { ACENTOS_PRESET, chequearAcento, contraste, normalizarHex } from '@/theme/contrast'
import { Wordmark } from '../Wordmark'

/* Datos de ejemplo: ilustrativos, no son barberías reales. */
const BARBERIAS: BarberiaResumen[] = [
  {
    slug: 'la-navaja',
    nombre: 'La Navaja',
    barrio: 'Palermo',
    direccion: 'Gorriti 4820',
    precioDesde: 12000,
    proximosHorarios: ['15:30', '16:15', '17:00', '18:45'],
    distanciaKm: 0.8,
  },
  {
    slug: 'barberia-del-puerto',
    nombre: 'Barbería del Puerto',
    barrio: 'San Telmo',
    direccion: 'Defensa 1150',
    colorAcento: ACENTOS_PRESET.cobre,
    precioDesde: 10500,
    proximosHorarios: [],
    distanciaKm: 3.4,
  },
]

const BARBEROS = ['Martín Sosa', 'Lucas Ferreyra', 'Tomás Ibarra']
const PASOS = ['Servicio', 'Barbero', 'Día y horario', 'Tus datos', 'Confirmar']
const HORARIOS = ['10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']
const OCUPADOS = new Set(['11:00', '14:30', '16:00'])

const SECCIONES = [
  ['color', 'Color'],
  ['tipografia', 'Tipografía'],
  ['forma', 'Espacio y forma'],
  ['botones', 'Botones'],
  ['formularios', 'Formularios'],
  ['datos', 'Datos'],
  ['reserva', 'Reserva'],
  ['portal', 'Portal'],
  ['feedback', 'Estados'],
  ['overlays', 'Capas'],
] as const

export default function DesignSystemPage() {
  const [acento, setAcento] = useState<string>(ACENTOS_PRESET.dorado)

  return (
    <AccentScope color={acento}>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Wordmark />
          <Badge tone="outline">Solo desarrollo</Badge>
        </Container>
      </header>

      <Container className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="Secciones" className="hidden lg:block">
          <ul className="sticky top-24 flex flex-col gap-0.5 py-12">
            {SECCIONES.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="focus-ring block rounded-sm px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-1 hover:text-ivory"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 pt-12 pb-32">
          <Intro acento={acento} onAcento={setAcento} />
          <ColorSection />
          <TypeSection />
          <ShapeSection />
          <ButtonsSection />
          <FormsSection />
          <DataSection />
          <BookingSection />
          <PortalSection />
          <FeedbackSection />
          <OverlaysSection />
        </main>
      </Container>
    </AccentScope>
  )
}

/* ——— Estructura ——— */

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-14 pb-6 first-of-type:border-t-0">
      <h2 className="display text-4xl font-medium text-ivory">{title}</h2>
      <p className="mt-3 max-w-2xl text-[0.9375rem] text-muted">{description}</p>
      <div className="mt-10 flex flex-col gap-12">{children}</div>
    </section>
  )
}

function Group({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="mb-5 text-sm font-semibold text-subtle">{title}</h3>
      {children}
    </div>
  )
}

/* ——— Intro + selector de acento ——— */

function Intro({ acento, onAcento }: { acento: string; onAcento: (hex: string) => void }) {
  const [custom, setCustom] = useState('')
  const hex = normalizarHex(custom)
  const chequeo = hex ? chequearAcento(hex) : null

  return (
    <div className="pb-16">
      <h1 className="display text-5xl leading-[1.04] font-medium text-ivory sm:text-6xl">
        Sistema de <em className="text-accent">diseño</em>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">
        Tokens y componentes base de NavAgenda. Todo lo que se construya usa estas piezas: si algo no está acá, se agrega
        acá primero.
      </p>

      <Card className="mt-10 max-w-2xl">
        <CardHeader
          title="Acento de la barbería"
          description="Cada barbería elige su color. Probalo: toda la página cambia, y los tonos de hover y fondo se recalculan solos."
        />
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(ACENTOS_PRESET).map(([nombre, valor]) => (
            <button
              key={nombre}
              type="button"
              onClick={() => onAcento(valor)}
              aria-pressed={acento === valor}
              className="focus-ring tap flex items-center gap-2.5 rounded-md border border-line-strong px-4 text-sm font-semibold text-ivory capitalize hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-accent-soft"
            >
              <span className="size-4 rounded-full" style={{ background: valor }} aria-hidden />
              {nombre}
            </button>
          ))}
        </div>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault()
            if (hex && chequeo?.valido) onAcento(hex)
          }}
        >
          <Field
            label="Color personalizado"
            className="flex-1"
            hint="Hexadecimal, ej. #B8925A"
            error={chequeo && !chequeo.valido ? `No llega a contraste AA (${chequeo.sobreFondo.toFixed(1)}:1 sobre el fondo). Probá un tono más claro.` : undefined}
          >
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="#B8925A" autoComplete="off" />
          </Field>
          <Button type="submit" variant="secondary" className="sm:mt-7" disabled={!chequeo?.valido}>
            Aplicar
          </Button>
        </form>
      </Card>
    </div>
  )
}

/* ——— Color ——— */

const PALETA: { grupo: string; items: { nombre: string; token: string; hex: string; uso: string }[] }[] = [
  {
    grupo: 'Fondo y superficies',
    items: [
      { nombre: 'Fondo', token: '--bg', hex: '#0E0D0C', uso: 'Base de la app' },
      { nombre: 'Superficie 1', token: '--surface-1', hex: '#171614', uso: 'Tarjetas y paneles' },
      { nombre: 'Superficie 2', token: '--surface-2', hex: '#1F1E1B', uso: 'Inputs y hover' },
      { nombre: 'Superficie 3', token: '--surface-3', hex: '#2A2825', uso: 'Popovers y menús' },
    ],
  },
  {
    grupo: 'Texto y líneas',
    items: [
      { nombre: 'Marfil', token: '--text', hex: '#F2ECE1', uso: 'Texto principal' },
      { nombre: 'Secundario', token: '--text-muted', hex: '#B8B0A3', uso: 'Descripciones' },
      { nombre: 'Tenue', token: '--text-subtle', hex: '#9A9388', uso: 'Ayudas y placeholders' },
      { nombre: 'Borde de control', token: '--border-input', hex: '#736C62', uso: 'Inputs (3:1)' },
    ],
  },
  {
    grupo: 'Estados del turno',
    items: [
      { nombre: 'Reservado', token: '--st-reservado', hex: '#8FB0D1', uso: 'Pendiente de atender' },
      { nombre: 'Asistió', token: '--st-asistio', hex: '#8DBF98', uso: 'Suma a facturación' },
      { nombre: 'No asistió', token: '--st-ausente', hex: '#E08A79', uso: 'Ausencia registrada' },
      { nombre: 'Cancelado', token: '--st-cancelado', hex: '#A39C91', uso: 'Liberó el horario' },
    ],
  },
]

function Swatch({ nombre, token, hex, uso }: { nombre: string; token: string; hex: string; uso: string }) {
  const ratio = contraste(hex, '#0e0d0c')
  return (
    <div>
      <div className="h-20 rounded-md border border-line" style={{ background: `var(${token})` }} />
      <p className="mt-3 text-sm font-semibold text-ivory">{nombre}</p>
      <p className="tabular mt-0.5 text-xs text-subtle">
        {hex} · {token}
      </p>
      <p className="mt-1 text-xs text-muted">
        {uso}
        {ratio >= 3 && <span className="tabular text-subtle"> · {ratio.toFixed(1)}:1</span>}
      </p>
    </div>
  )
}

function ColorSection() {
  return (
    <Section
      id="color"
      title="Color"
      description="Carbón cálido en capas, texto marfil y un único acento metálico que se usa con moderación: acciones principales, selección y detalles. Los contrastes se miden contra el fondo."
    >
      <Group title="Acento">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <div className="col-span-2">
            <div className="flex h-20 overflow-hidden rounded-md border border-line">
              <div className="flex-[3] bg-accent" />
              <div className="flex-1 bg-accent-hover" />
              <div className="flex-1 bg-accent-soft" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ivory">Acento · hover · soft</p>
            <p className="mt-0.5 text-xs text-subtle">--accent, derivados con color-mix en oklch</p>
          </div>
        </div>
      </Group>
      {PALETA.map((g) => (
        <Group key={g.grupo} title={g.grupo}>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {g.items.map((s) => (
              <Swatch key={s.token} {...s} />
            ))}
          </div>
        </Group>
      ))}
    </Section>
  )
}

/* ——— Tipografía ——— */

const ESCALA = [
  ['6xl', 'text-6xl', '64'],
  ['5xl', 'text-5xl', '48'],
  ['4xl', 'text-4xl', '38'],
  ['3xl', 'text-3xl', '30'],
  ['2xl', 'text-2xl', '24'],
  ['xl', 'text-xl', '20'],
  ['lg', 'text-lg', '18'],
  ['base', 'text-base', '16'],
  ['sm', 'text-sm', '14'],
  ['xs', 'text-xs', '12'],
] as const

function TypeSection() {
  return (
    <Section
      id="tipografia"
      title="Tipografía"
      description="Bodoni Moda para títulos y cifras destacadas: alto contraste, de barbería clásica. Manrope para toda la interfaz, con cifras tabulares en precios, horarios y métricas."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Card padding="lg">
          <p className="text-xs font-semibold text-subtle">Display · Bodoni Moda</p>
          <p className="display mt-6 text-6xl leading-none font-medium text-ivory">
            Corte <em className="text-accent">&amp;</em> barba
          </p>
          <p className="display tabular mt-6 text-3xl text-muted">$ 14.500 · 45 min</p>
        </Card>
        <Card padding="lg">
          <p className="text-xs font-semibold text-subtle">Interfaz · Manrope</p>
          <p className="mt-6 text-2xl font-semibold text-ivory">Elegí día y horario</p>
          <p className="mt-3 text-[0.9375rem] text-muted">
            Tu turno se confirma al instante. Podés cancelarlo hasta 3 horas antes desde el link que te damos.
          </p>
          <p className="tabular mt-5 text-lg font-semibold text-ivory">10:30 · 11:00 · 11:30 · 12:00</p>
        </Card>
      </div>
      <Group title="Escala (px)">
        <ul className="divide-y divide-line">
          {ESCALA.map(([nombre, clase, px]) => (
            <li key={nombre} className="flex items-baseline gap-6 py-3">
              <span className="tabular w-16 shrink-0 text-xs text-subtle">
                {nombre} · {px}
              </span>
              <span className={cn(clase, Number(px) >= 30 ? 'display font-medium' : 'font-medium', 'truncate text-ivory')}>
                Reservá tu turno
              </span>
            </li>
          ))}
        </ul>
      </Group>
    </Section>
  )
}

/* ——— Espacio y forma ——— */

function ShapeSection() {
  return (
    <Section
      id="forma"
      title="Espacio y forma"
      description="Base de 4px. Radios contenidos, bordes de 1px y sombras suaves solo para lo que flota (menús, diálogos, notificaciones). Cada pieza declara una sola elevación: borde o sombra."
    >
      <Group title="Espaciado">
        <div className="flex flex-wrap items-end gap-4">
          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map((n) => (
            <div key={n} className="flex flex-col items-center gap-2">
              <div className="bg-accent-soft" style={{ width: n * 4, height: n * 4 }} />
              <span className="tabular text-xs text-subtle">{n * 4}</span>
            </div>
          ))}
        </div>
      </Group>
      <div className="grid gap-12 md:grid-cols-2">
        <Group title="Radios">
          <div className="flex gap-5">
            {[
              ['sm · 6', 'rounded-sm'],
              ['md · 10', 'rounded-md'],
              ['lg · 16', 'rounded-lg'],
              ['full', 'rounded-full'],
            ].map(([l, c]) => (
              <div key={l} className="flex flex-col items-center gap-2">
                <div className={cn('size-16 border border-line-strong bg-surface-2', c)} />
                <span className="text-xs text-subtle">{l}</span>
              </div>
            ))}
          </div>
        </Group>
        <Group title="Elevación">
          <div className="flex gap-5">
            {['shadow-1', 'shadow-2', 'shadow-3'].map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <div className={cn('size-16 rounded-md bg-surface-3', s)} />
                <span className="text-xs text-subtle">{s}</span>
              </div>
            ))}
          </div>
        </Group>
      </div>
    </Section>
  )
}

/* ——— Botones ——— */

function ButtonsSection() {
  const [cargando, setCargando] = useState(false)
  return (
    <Section
      id="botones"
      title="Botones"
      description="Una sola acción principal por pantalla, en el acento. Todas las alturas superan los 44px de objetivo táctil."
    >
      <Group title="Variantes">
        <div className="flex flex-wrap gap-3">
          <Button>Confirmar turno</Button>
          <Button variant="secondary">Cambiar horario</Button>
          <Button variant="ghost">Volver</Button>
          <Button variant="danger" icon={<Trash2 />}>
            Dar de baja
          </Button>
        </div>
      </Group>
      <Group title="Tamaños, íconos y estados">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" icon={<Plus />}>
            Turno manual
          </Button>
          <Button size="md">Reservar</Button>
          <Button size="lg">Reservar ahora</Button>
          <Button
            variant="secondary"
            loading={cargando}
            onClick={() => {
              setCargando(true)
              setTimeout(() => setCargando(false), 1800)
            }}
          >
            {cargando ? 'Guardando' : 'Guardar cambios'}
          </Button>
          <Button disabled>Sin horarios</Button>
          <Tooltip content="Configuración">
            <IconButton label="Configuración" icon={<Settings2 />} variant="secondary" />
          </Tooltip>
          <IconButton label="Filtros" icon={<SlidersHorizontal />} />
        </div>
      </Group>
    </Section>
  )
}

/* ——— Formularios ——— */

function FormsSection() {
  const [vista, setVista] = useState<'dia' | 'semana'>('dia')
  return (
    <Section
      id="formularios"
      title="Formularios"
      description="Label siempre visible, ayuda debajo y errores que dicen qué pasó y cómo seguir. Los inputs miden 48px y usan 16px de texto para que iOS no haga zoom."
    >
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <Field label="Tu nombre" hint="Así te va a llamar el barbero.">
          <Input placeholder="Juan Pérez" autoComplete="name" icon={<UserRound />} />
        </Field>
        <Field label="Teléfono" error="Revisá el número: tiene que tener código de área, ej. 11 2233 4455.">
          <Input type="tel" inputMode="tel" defaultValue="22334" autoComplete="tel" />
        </Field>
        <Field label="Contraseña del panel">
          <PasswordInput placeholder="••••••••" />
        </Field>
        <Field label="Servicio">
          <Select
            options={[
              { value: 'corte', label: 'Corte · 30 min' },
              { value: 'corte-barba', label: 'Corte + barba · 45 min' },
              { value: 'barba', label: 'Barba · 20 min' },
              { value: 'color', label: 'Color · 60 min', disabled: true },
            ]}
          />
        </Field>
        <Field label="Nota para el barbero" optional className="md:col-span-2">
          <Textarea placeholder="Ej.: degradé bajo, dejar largo arriba" rows={3} />
        </Field>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <Group title="Selección">
          <div className="flex flex-col gap-2">
            <Checkbox label="Hace corte + barba" description="Aparece en ese servicio al reservar." defaultChecked />
            <Checkbox label="Trabaja los domingos" />
            <Switch label="Barbero activo" description="Si lo apagás, deja de aparecer para reservar." defaultChecked />
          </div>
        </Group>
        <Group title="Selector segmentado">
          <SegmentedControl
            label="Vista de la grilla"
            value={vista}
            onValueChange={setVista}
            options={[
              { value: 'dia', label: 'Día' },
              { value: 'semana', label: 'Semana' },
            ]}
          />
        </Group>
      </div>
    </Section>
  )
}

/* ——— Datos ——— */

function DataSection() {
  const estados: EstadoTurno[] = ['reservado', 'asistio', 'no_asistio', 'cancelado', 'bloqueo']
  return (
    <Section
      id="datos"
      title="Datos"
      description="Métricas grandes en la serif con cifras tabulares, estados del turno con color, ícono y texto, y fotos de barberos en círculo con recorte centrado en la cara."
    >
      <Group title="Métricas · datos de ejemplo">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Facturado hoy" value={formatPrecio(186500)} delta={12.4} deltaLabel="vs. martes pasado" />
          <MetricCard label="Cortes de la semana" value="64" delta={-3.1} deltaLabel="vs. semana pasada" />
          <MetricCard label="Tasa de ausencias" value="6,2%" delta={-1.8} invertDelta deltaLabel="vs. mes pasado" />
          <MetricCard
            label="Próximo turno"
            value="15:30"
            footer={
              <span>
                <span className="text-ivory">Nicolás R.</span> · Corte + barba
              </span>
            }
          />
        </div>
      </Group>
      <div className="grid gap-12 md:grid-cols-2">
        <Group title="Estado del turno">
          <div className="flex flex-wrap gap-2">
            {estados.map((e) => (
              <StatusPill key={e} estado={e} />
            ))}
          </div>
        </Group>
        <Group title="Etiquetas">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">
              <CircleCheck aria-hidden /> Beneficio disponible
            </Badge>
            <Badge>3 visitas</Badge>
            <Badge tone="outline">Turno manual</Badge>
          </div>
        </Group>
        <Group title="Barberos">
          <div className="flex items-center gap-4">
            <Avatar name="Martín Sosa" size="xl" ring />
            <Avatar name="Lucas Ferreyra" size="lg" />
            <Avatar name="Tomás Ibarra" size="md" />
            <Avatar name="Sin Foto" size="sm" />
          </div>
        </Group>
        <Group title="Precios">
          <div className="flex flex-col gap-2 text-lg font-semibold text-ivory">
            <Price amount={14500} />
            <span className="flex items-center gap-3">
              <Price amount={14500} strike className="text-base font-normal" />
              <Price amount={0} className="text-success" /> <Badge tone="accent">Corte gratis</Badge>
            </span>
            <Price amount={10500} from className="text-base" />
          </div>
        </Group>
      </div>
    </Section>
  )
}

/* ——— Reserva ——— */

function BookingSection() {
  const [paso, setPaso] = useState(2)
  const [hora, setHora] = useState<string | null>('15:00')
  return (
    <Section
      id="reserva"
      title="Reserva"
      description="Piezas del flujo de reserva: progreso por pasos, pestañas por barbero y horarios. Los ocupados quedan visibles pero tachados, para que se entienda la agenda."
    >
      <Card padding="lg">
        <Stepper steps={PASOS} current={paso} />
        <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {HORARIOS.map((h) => (
            <TimeSlot
              key={h}
              time={h}
              disabled={OCUPADOS.has(h)}
              selected={hora === h}
              onClick={() => setHora(h)}
            />
          ))}
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0}>
            Atrás
          </Button>
          <Button onClick={() => setPaso((p) => Math.min(PASOS.length - 1, p + 1))} disabled={!hora}>
            {hora ? `Continuar con las ${hora}` : 'Elegí un horario'}
          </Button>
        </div>
      </Card>
      <Group title="Pestañas por barbero">
        <Tabs defaultValue={BARBEROS[0]}>
          <TabsList label="Barberos">
            <Tab value="todos">Todos</Tab>
            {BARBEROS.map((b) => (
              <Tab key={b} value={b} icon={<Avatar name={b} size="sm" className="size-6 text-[0.625rem]" />}>
                {b.split(' ')[0]}
              </Tab>
            ))}
          </TabsList>
          {['todos', ...BARBEROS].map((b) => (
            <TabsContent key={b} value={b} className="focus-ring rounded-md pt-6 text-[0.9375rem] text-muted">
              {b === 'todos' ? 'Grilla del día con todos los barberos lado a lado.' : `Grilla y dashboard de ${b}.`}
            </TabsContent>
          ))}
        </Tabs>
      </Group>
    </Section>
  )
}

/* ——— Portal ——— */

function PortalSection() {
  const [busqueda, setBusqueda] = useState<Busqueda>({ zona: '', servicio: '', fecha: '' })
  const [pin, setPin] = useState(BARBERIAS[0].slug)
  const notify = useToast()
  return (
    <Section
      id="portal"
      title="Portal"
      description="Componentes del portal NavAgenda. Cada resultado lleva el acento de su barbería: la segunda tarjeta usa el preset cobre. Datos de ejemplo."
    >
      <SearchBar
        value={busqueda}
        onChange={setBusqueda}
        onSubmit={(b) =>
          notify({
            tone: 'info',
            title: 'Búsqueda de ejemplo',
            description: [b.zona, b.servicio, b.fecha].filter(Boolean).join(' · ') || 'Sin filtros',
          })
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {BARBERIAS.map((b) => (
          <BarberiaCard key={b.slug} barberia={b} href={`#portal`} active={pin === b.slug} />
        ))}
      </div>
      <Group title="Marcadores del mapa">
        <div className="flex h-40 items-center justify-center gap-10 rounded-lg border border-line bg-surface-1">
          {BARBERIAS.map((b) => (
            <MapPin
              key={b.slug}
              label={b.nombre}
              precioDesde={b.precioDesde}
              active={pin === b.slug}
              onClick={() => setPin(b.slug)}
            />
          ))}
        </div>
      </Group>
    </Section>
  )
}

/* ——— Estados ——— */

function FeedbackSection() {
  const notify = useToast()
  return (
    <Section
      id="feedback"
      title="Estados"
      description="Cargas con skeleton que respetan la forma final, vacíos que dicen qué hacer y errores recuperables. Nada de alerts del navegador: todo pasa por notificaciones propias."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <SkeletonGroup label="Cargando barberos" className="flex flex-col gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton rounded="full" className="size-11" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        </Card>
        <Card padding="none">
          <EmptyState
            icon={<CalendarX2 />}
            title="Día libre"
            description="No hay turnos para hoy. Podés cargar uno a mano si alguien llama o pasa por la puerta."
            action={
              <Button size="sm" icon={<Plus />}>
                Turno manual
              </Button>
            }
          />
        </Card>
        <Card padding="none">
          <ErrorState onRetry={() => notify({ tone: 'info', title: 'Reintentando…' })} />
        </Card>
        <Card>
          <CardHeader title="Notificaciones" description="Abajo en mobile, a la derecha en desktop." />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                notify({ tone: 'success', title: 'Turno confirmado', description: 'Miércoles 21 a las 15:00 con Martín.' })
              }
            >
              Éxito
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                notify({
                  tone: 'error',
                  title: 'Ese horario se acaba de ocupar',
                  description: 'Elegí otro: te mostramos los que siguen libres.',
                })
              }
            >
              Error
            </Button>
            <Button variant="secondary" size="sm" onClick={() => notify({ tone: 'info', title: 'Cambios guardados' })}>
              Info
            </Button>
          </div>
        </Card>
      </div>
    </Section>
  )
}

/* ——— Capas ——— */

function OverlaysSection() {
  const notify = useToast()
  return (
    <Section
      id="overlays"
      title="Capas"
      description="Diálogos solo cuando hay que interrumpir. En mobile, los paneles suben desde abajo; en desktop se abren a la derecha."
    >
      <div className="flex flex-wrap gap-3">
        <Dialog
          trigger={<Button variant="secondary">Abrir diálogo</Button>}
          title="Bloquear horario"
          description="El horario deja de estar disponible para reservar."
          footer={<Button onClick={() => notify({ tone: 'success', title: 'Horario bloqueado' })}>Bloquear</Button>}
        >
          <Field label="Motivo" optional>
            <Input placeholder="Ej.: almuerzo, trámite" />
          </Field>
        </Dialog>
        <Sheet
          trigger={<Button variant="secondary">Abrir panel</Button>}
          title="Turno de las 15:30"
          description="Nicolás R. · Corte + barba"
          footer={
            <>
              <Button fullWidth icon={<CircleCheck />}>
                Asistió
              </Button>
              <Button fullWidth variant="secondary">
                No asistió
              </Button>
            </>
          }
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-[0.9375rem]">
            <dt className="text-subtle">Barbero</dt>
            <dd className="text-ivory">Martín Sosa</dd>
            <dt className="text-subtle">Precio</dt>
            <dd>
              <Price amount={14500} className="font-semibold text-ivory" />
            </dd>
            <dt className="text-subtle">Estado</dt>
            <dd>
              <StatusPill estado="reservado" />
            </dd>
            <dt className="text-subtle">Fidelidad</dt>
            <dd className="text-ivory">4 de 5 cortes</dd>
          </dl>
        </Sheet>
        <ConfirmDialog
          trigger={
            <Button variant="danger" icon={<Trash2 />}>
              Cancelar turno
            </Button>
          }
          title="¿Cancelar el turno?"
          description="Se libera el horario de las 15:30 con Martín. Esta acción no se puede deshacer."
          confirmLabel="Sí, cancelar"
          destructive
          onConfirm={() => new Promise((r) => setTimeout(r, 900)).then(() => notify({ tone: 'success', title: 'Turno cancelado' }))}
        />
        <Popover trigger={<Button variant="ghost" icon={<Scissors />}>Ver servicios</Button>}>
          <ul className="flex flex-col gap-3 text-[0.9375rem]">
            {[
              ['Corte', 12000],
              ['Corte + barba', 14500],
              ['Barba', 7000],
            ].map(([n, p]) => (
              <li key={n} className="flex justify-between gap-4">
                <span className="text-ivory">{n}</span>
                <Price amount={p as number} className="text-muted" />
              </li>
            ))}
          </ul>
        </Popover>
        <Tooltip content="Descarga el turno para tu calendario">
          <Button variant="ghost" icon={<Download />}>
            Agregar al calendario
          </Button>
        </Tooltip>
      </div>
    </Section>
  )
}
