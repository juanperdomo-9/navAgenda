# NavAgenda — plataforma de turnos para barberías (MVP)

## Qué es
Plataforma de turnos online para barberías, al estilo de un portal tipo HayCanchas (en funcionalidad, no en lo visual).
Hay un portal común donde el cliente busca barberías por zona, servicio y día, las ve en un mapa y reserva.
Cada barbería tiene además su propia página con sus barberos y servicios con precio.
El admin ve una grilla por barbero y marca si el cliente asistió.
Cada asistencia suma al total facturado y cuenta para un beneficio de fidelidad que configura cada barbería.
Sin seña: la reserva se confirma al instante.

Modelo de negocio: suscripción mensual por barbería (multi-barbería desde el día uno).

**Ciudad principal: La Plata** (casco urbano y alrededores: Tolosa, Gonnet, City Bell, Los Hornos, etc.).
Las direcciones usan el formato platense ("Calle 8 e/ 49 y 50").

## Stack
- Backend: Python 3.12 (FastAPI), SQLAlchemy 2, Alembic para migraciones, pytest. Dependencias con `uv`.
- Frontend: React + TypeScript (Vite), Tailwind CSS v4 con tokens en variables CSS, Radix UI como primitivas accesibles, lucide-react, TanStack Query, react-router, react-hook-form + zod, date-fns + @date-fns/tz. Tests con Vitest.
- Mapa: MapLibre GL con tiles de OpenFreeMap (gratis, sin API key).
- Base de datos: Postgres en Supabase
- Deploy: Render
- Zona horaria: guardar en UTC, mostrar en America/Argentina/Buenos_Aires
- Moneda: ARS, formateada con `Intl.NumberFormat('es-AR')`, sin decimales.

## Roles
1. **Superadmin** (Juan): crea barberías y les asigna un usuario dueño (admin). Resetea contraseñas de admins.
2. **Admin de barbería**: desde un único panel gestiona todo: crea barberos, servicios, horarios y beneficios. Ve la grilla y el dashboard de cada barbero, además del dashboard general.
3. **Cliente**: **no tiene cuenta**. Reserva con nombre + teléfono, ve y cancela sus turnos desde un link privado, y ve su progreso hacia el beneficio.

Los barberos **no tienen login propio** en el MVP: son entidades que crea y gestiona el admin.

## Clientes: sin registro ni login
- Para reservar, el cliente solo ingresa **nombre + teléfono**. La reserva se confirma al instante.
- El **teléfono identifica al cliente**. Se guarda normalizado en E.164 (ej.: `+5491122334455`) para que distintas formas de escribirlo sean el mismo número.
- La **fidelidad es por barbería y por teléfono**: cada barbería tiene su regla y su contador. Los turnos que carga el admin a mano (con nombre + teléfono) también suman.
- **"Mis turnos" sin login**: al confirmar, el cliente recibe un **link privado** del turno (token aleatorio no adivinable). Desde ahí ve el turno, lo cancela respetando la anticipación mínima, lo agrega a su calendario (.ics) y ve su progreso de fidelidad.
  El teléfono queda recordado en el dispositivo para que "Mis turnos" muestre todo sin volver a tipearlo.
  **Nunca** se pueden ver ni cancelar turnos solo escribiendo un teléfono (cualquiera podría ver los turnos de otro).
- Anti-abuso: máximo 2 turnos futuros por teléfono por barbería, límite de reservas por IP, y el admin puede bloquear un teléfono.
- Riesgo aceptado: sin SMS no se verifica que el número sea de quien lo carga. El beneficio se aplica en persona en la barbería. Verificar por SMS/WhatsApp queda para después del MVP.

## Login (solo admin y superadmin)
- Usuario + contraseña. Usuario único global, sin distinción de mayúsculas.
- Contraseñas hasheadas (argon2). Sesión con JWT en cookie httpOnly.
- El usuario admin de cada barbería lo crea el superadmin; no se registra solo. El superadmin resetea contraseñas de admins.
- Límite de intentos fallidos para evitar fuerza bruta: 5 claves mal bloquean la cuenta 15 min,
  más un tope de 20 intentos por IP cada 15 min (en memoria; alcanza para una instancia).
- Cookie `navagenda_sesion`: httpOnly, SameSite=Lax, Secure en producción, 12 h.
- Las claves temporales (alta de barbería o reseteo) obligan a cambiarla antes de usar el panel.
- Endpoints: `/auth/ingresar`, `/auth/salir`, `/auth/yo`, `/auth/cambiar-clave`, `/super/barberias`,
  `/super/usuarios/{id}/resetear-clave`.

## Alcance del MVP

### Portal NavAgenda `/`
- Buscador por zona/barrio, servicio y fecha.
- Resultados en lista + **mapa** con la ubicación de cada barbería y cuál queda más cerca.
- **Horarios libres de todas**: elegís día y hora (y zona) y muestra qué barberías y barberos tienen lugar.
- Cada resultado lleva a la página pública de la barbería.
- El portal usa la identidad de la plataforma ("El turnero"); la página de cada barbería usa su color de acento.

### Panel del admin de barbería (todo vive acá)
- **Barberos**: crear, editar y dar de baja (foto, nombre, horarios laborales por día de la semana, días libres).
  **Al crear un barbero se genera automáticamente todo lo suyo**: su grilla, su dashboard, su disponibilidad en la página pública y su asignación a los servicios. No hace falta configurar nada más.
  Al dar de baja un barbero se conserva su historial (baja lógica) y deja de aparecer para reservar.
- **Navegación por barbero**: dentro del panel, un selector o pestañas por barbero que abren su grilla y su dashboard. También hay una vista "todos" con la grilla del día de todos los barberos lado a lado.
- **Servicios**: nombre, precio, duración (ej.: corte 30 min, corte + barba 45 min). Opcional: qué barberos lo hacen.
- **Grilla por barbero**: vista de día y de semana, con un barbero por columna (o selector de barbero en mobile).
  Cada turno muestra cliente, servicio, precio y estado, con botones **Asistió / No asistió**.
  - Asistió → suma al total facturado y suma 1 al contador de fidelidad del cliente (por teléfono) en esa barbería.
  - No asistió → no suma nada y queda registrado.
  - El admin puede crear turnos a mano (cliente que llama o pasa por la puerta, con nombre + teléfono) y bloquear horarios.
- **Beneficios**: el admin define la regla "cada **X** cortes asistidos → **beneficio**".
  Tipos: % de descuento, monto fijo de descuento, servicio gratis o texto libre.
  Al llegar a X, el cliente tiene el beneficio disponible. El admin lo aplica al marcar el turno y el contador se reinicia.
- **Clientes**: listado (por teléfono) con cantidad de visitas, ausencias y beneficios usados. Botón para bloquear un teléfono.
- **Dashboard general**: facturación del día, la semana y el mes, cortes por barbero, tasa de ausencias y servicios más vendidos.
- **Configuración**: nombre, logo, color de acento (con aviso si no cumple contraste AA), dirección, ciudad, barrio, ubicación en el mapa (el admin marca un punto), descripción, horas mínimas de anticipación para cancelar.

### Dashboard de cada barbero (tipo ERP, dentro del panel admin)
- Facturación del día, la semana y el mes (solo turnos con "asistió").
- Cantidad de cortes, ausencias y próximos turnos.
- Gráfico de evolución semanal o mensual.
- Detalle por servicio.
- Comparativa rápida entre barberos en el dashboard general.

### Página pública de la barbería `navagenda.com.ar/:slug` (objetivo principal)
Es **el link que comparte cada barbería** (Instagram, WhatsApp, Google) y donde se sacan los turnos con cada barbero.
Es la pantalla más importante del producto: tiene que funcionar perfecta en el celular.
La ruta va en la raíz (`/la-navaja`), así que hay slugs reservados que ninguna barbería puede usar:
`panel`, `super`, `t`, `api`, `buscar`, `mapa`, `mis-turnos`, `ingresar`, `dev`, `assets`, `static`, `health`.
- Portada con logo, nombre, dirección, barberos y servicios con precios.
- Flujo de reserva: elegir servicio → elegir barbero (o "el primero disponible") → elegir día y horario → nombre + teléfono → confirmar.
- Pantalla de confirmación con el link privado del turno, botón "agregar al calendario" y progreso del beneficio ("te faltan 2 cortes para tu corte gratis").

Convenciones de la base: IDs UUID, fechas `timestamptz` (UTC), estados y tipos como texto con CHECK.
Las tablas hijas llevan `barberia_id` con FKs compuestas `(id, barberia_id)`: la base rechaza mezclar datos de dos barberías.

## Reglas de negocio clave
- Nunca dos turnos superpuestos para el mismo barbero. Validarlo en el backend y con constraint en la base (EXCLUDE con btree_gist).
- Los horarios disponibles salen de: horario laboral del barbero − turnos existentes − bloqueos − duración del servicio.
- El precio se guarda en el turno al reservar (si después cambia el precio del servicio, los turnos viejos no cambian).
- Solo el estado "asistió" cuenta para facturación y fidelidad.
- Cada barbería ve únicamente sus datos (aislamiento por `barberia_id` en todas las consultas del panel).
- La fidelidad es por (barbería, teléfono). Un mismo teléfono tiene contadores independientes en cada barbería.

## Modelo de datos (base)
- `barberias`: id, nombre, slug, logo_url, color_acento, direccion, ciudad, barrio, lat, lng, descripcion, horas_min_cancelacion, activa
- `usuarios` (solo admin/superadmin): id, barberia_id (null para superadmin), nombre, usuario, password_hash, rol (superadmin/admin), activo
- `barberos`: id, barberia_id, nombre, foto_url, activo, creado_en
- `horarios_barbero`: id, barbero_id, dia_semana (0 = lunes), desde, hasta — puede haber varios tramos por día
- `servicios`: id, barberia_id, nombre, precio (pesos enteros), duracion_min (múltiplo de 5), activo
- `barbero_servicios`: barbero_id, servicio_id, barberia_id — qué servicios hace cada barbero
- `clientes`: id, barberia_id, telefono (E.164), nombre, bloqueado, creado_en — único por (barberia_id, telefono)
- `turnos`: id, barberia_id, barbero_id, cliente_id, servicio_id, inicio, fin, precio, estado (reservado/asistio/no_asistio/cancelado), beneficio_aplicado, token_acceso_hash, origen (web/manual), creado_en
- `bloqueos`: id, barberia_id, barbero_id, inicio, fin, motivo (los días libres sueltos son bloqueos de día completo)
- `reglas_beneficio`: id, barberia_id, cada_x_cortes, tipo, valor, servicio_id (para servicio gratis), descripcion, activa — una sola activa por barbería
- `fidelidad`: cliente_id, barberia_id, cortes_acumulados, beneficios_disponibles

## Diseño: "El turnero"
Dirección aprobada por Juan el 2026-10-20 (reemplaza la estética oscura/dorada de la tarea 1).
La web es el turnero del barrio: "Sacá número". Prototipo vivo en `design/hero/index.html`
(se sirve con `python -m http.server 5180 --directory design`). Las pantallas reales se construyen
a partir de ese prototipo; los tokens de `frontend/src/styles/tokens.css` se migran a esta dirección
cuando se porte (tarea 6/6b).

Prioridad del producto: **entrar, sacar el turno y salir**. Lindo, simple y conciso.

- Paleta: amarillo de rollo de turnos `#F6D13A`, tinta `#141210`, papel de ticket `#FFFDF3`,
  display `#120C0B` con LED rojo `#FF2B1C` (apagado `#2E0F0B`). Sin grises sobre el amarillo:
  el texto secundario usa tinta gastada `#3D3310`.
- Tipografía: **Archivo** (variable): titulares en el ancho más angosto (`font-stretch: 62%`, peso 900,
  mayúsculas) a tamaños extremos; interfaz en Archivo normal. Los números del display son
  **7 segmentos dibujados en SVG** (no una fuente).
- Elemento firma: el display LED muestra el próximo horario libre y sus segmentos se encienden de a uno
  al cambiar; el cero de adelante queda apagado. La confirmación es un **ticket impreso**, que además
  es el link privado del turno. La fidelidad se muestra como **perforaciones** en el ticket.
- Talones con bordes perforados para horarios alternativos. Nada de tarjetas genéricas.
- Prohibido (patrones genéricos de IA): hero centrado con título + subtítulo + 2 botones, grillas de
  3 tarjetas con ícono, gradientes violeta/azul, glassmorphism, sombras suaves en todo,
  Inter/Poppins/Montserrat, testimonios en grilla, emojis como íconos, 3D de stock,
  secciones todas iguales.
- Voz: voseo, corta y concreta ("Sacá número", "Sin fila. Sin cuenta. Sin seña").
- Cada barbería conserva su color de acento en su página (`/:slug`) y en su ticket.
- Panel admin: pendiente de definir dentro de esta dirección (más sobrio, el display LED como métrica).
- **Mobile first**: el cliente reserva desde el celular y el barbero mira su grilla desde el celular.
- Accesible: contraste AA, foco visible (amarillo dentro del display), objetivos táctiles ≥ 44px,
  respeta reduced motion, cambios anunciados con aria-live.
- Estados vacíos, errores y confirmaciones diseñados (nada de alerts del navegador).
- Proceso: ante una pantalla nueva, armar primero el hero, pasarle `/impeccable critique` y corregir.

## Fuera del MVP (no construir todavía)
- Pagos o señas online
- Notificaciones por WhatsApp, SMS o email
- Verificación del teléfono por SMS/WhatsApp
- Cuentas de cliente con login
- Comisiones de barberos y liquidación de sueldos
- Venta de productos o stock
- App móvil nativa
- Login propio para barberos
- Cobro automático de la suscripción a las barberías

## Cómo trabajar en este repo
- Antes de cada tarea, proponé un plan corto y esperá aprobación.
- Una tarea por vez; un commit por tarea con mensaje claro.
- Tests obligatorios para: cálculo de horarios disponibles, superposición de turnos, contador de fidelidad y aislamiento entre barberías.
- Nunca leer, modificar ni commitear `.env`. Nunca hacer deploy a producción: eso lo hace Juan después de revisar.
- Si algo del alcance no está claro, preguntar en vez de inventar.

## Comandos
- Frontend: `cd frontend && npm install && npm run dev` (http://localhost:5173), `npm run build`, `npm test`, `npm run typecheck`
- Base local: `docker compose up -d` (Postgres 17 en localhost:5433, bases `navagenda` y `navagenda_test`)
- Backend: `cd backend && uv sync && uv run uvicorn app.main:app --reload` (http://localhost:8000/health), `uv run pytest`
- Migraciones: `cd backend && uv run alembic upgrade head` (usa `DATABASE_URL`; sin definir, la base local)
- Datos de ejemplo: `cd backend && uv run python -m app.db.seed` (8 barberías de La Plata, un admin por barbería con usuario = slug)
- Crear el superadmin: `cd backend && uv run python -m app.cli crear-superadmin <usuario> "<nombre>"` (pide la clave)

## Orden de tareas
1. ✅ Sistema de diseño (tokens y componentes base) y estructura del proyecto
2. ✅ Esquema de base y migraciones (Alembic sobre Supabase), con datos de ejemplo (1 barbería, 3 barberos, 4 servicios)
3. ✅ Auth del panel (admin y superadmin) con usuario y contraseña, y roles (backend; la pantalla de login va con el panel en la tarea 4)
4. ABM de barberos, servicios y horarios
5. Cálculo de horarios disponibles (con tests)
6. Página pública de la barbería y flujo de reserva sin cuenta (nombre + teléfono, link privado)
6b. Portal NavAgenda: buscador, mapa y "horarios libres de todas"
7. Grilla por barbero con asistió / no asistió
8. Beneficios y fidelidad (por barbería y teléfono)
9. Dashboard del barbero y dashboard general
10. Pulido visual completo, revisión mobile y prueba de punta a punta
