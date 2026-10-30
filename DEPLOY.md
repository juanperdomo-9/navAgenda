# Publicar NavAgenda (Render + Supabase)

1. **Supabase**: creá un proyecto (región São Paulo). En *Project Settings → Database → Connection string → URI*,
   copiá la del **Session pooler** y cambiá el comienzo `postgresql://` por `postgresql+psycopg://`.
2. **Render**: *New → Blueprint* y elegí este repo (usa `render.yaml`, plan free). Cuando te pida `DATABASE_URL`,
   pegá la de Supabase. Al terminar quedan `navagenda-api` y `navagenda-web`.
3. **Claves (sin Shell y sin que pasen por los logs)**: en el primer arranque la API crea las tablas, tu superadmin
   `juan` y la barbería Inspirationmen con su admin `inspirationmen`. Las claves temporales se cargan como hash
   argon2 en variables de entorno de `navagenda-api`: `CLAVE_TEMPORAL_JUAN` y `CLAVE_TEMPORAL_INSPIRATIONMEN`
   (para otro usuario: `CLAVE_TEMPORAL_<USUARIO>`, con "_" en lugar de "-"). Generar clave y hash:
   `uv run python -c "from app.core.security import clave_temporal, hashear_clave as h; c=clave_temporal(); print(c, h(c))"`.
   Solo se aplican mientras el usuario no eligió su clave; en los logs aparece "clave temporal aplicada".
   Después del primer ingreso se pueden borrar las variables.
4. Entrá a `https://navagenda-web.onrender.com/panel/ingresar` con `juan` y tu clave temporal: te pide elegir una
   propia. Pasale al dueño de Inspirationmen su usuario y su clave temporal (al entrar elige la suya y marca su
   local en *Mi página*). Probá `https://navagenda-web.onrender.com/inspirationmen`.
5. Plan free: la API se duerme a los 15 min sin uso (el primero espera ~50 s). Opcional: un ping gratis cada
   10 min a `https://navagenda-api.onrender.com/health` (ej.: cron-job.org).

6. **Avisos por mail a cada barbero (Brevo, gratis hasta 300 por día)**: creá la cuenta en brevo.com, verificá tu
   mail como remitente (*Senders, Domains & Dedicated IPs → Senders*) y generá una clave en *SMTP & API → API Keys*.
   En Render → `navagenda-api` → *Environment* agregá `BREVO_API_KEY` (la clave) y `BREVO_REMITENTE` (el mail
   verificado). Cada barbero carga su mail en *Barberos → editar*. Sin la clave no se manda nada.

Si se pierde una clave: el superadmin resetea la de cualquier admin desde su panel.

Dominio propio: en Render → `navagenda-web` → *Custom domains* (después).
Si el nombre `navagenda-api` ya está tomado en Render, cambiá la URL del rewrite en `render.yaml`.
