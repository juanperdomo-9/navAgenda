# Publicar NavAgenda (Render + Supabase)

1. **Supabase**: creá un proyecto (región São Paulo). En *Project Settings → Database → Connection string → URI*,
   copiá la del **Session pooler** y cambiá el comienzo `postgresql://` por `postgresql+psycopg://`.
2. **Render**: *New → Blueprint* y elegí este repo (usa `render.yaml`, plan free). Cuando te pida `DATABASE_URL`,
   pegá la de Supabase. Al terminar quedan `navagenda-api` y `navagenda-web`.
3. **Claves (sin Shell)**: en el primer arranque la API crea las tablas, tu superadmin `juan` y la barbería
   Inspirationmen con su admin `inspirationmen`, cada uno con una clave temporal al azar.
   Las ves en Render → `navagenda-api` → *Logs*, en las líneas que empiezan con `[NavAgenda]`.
   En los arranques siguientes no se crea ni se cambia nada.
4. Entrá a `https://navagenda-web.onrender.com/panel/ingresar` con `juan` y tu clave temporal: te pide elegir una
   propia. Pasale al dueño de Inspirationmen su usuario y su clave temporal (al entrar elige la suya y marca su
   local en *Mi página*). Probá `https://navagenda-web.onrender.com/inspirationmen`.
5. Plan free: la API se duerme a los 15 min sin uso (el primero espera ~50 s). Opcional: un ping gratis cada
   10 min a `https://navagenda-api.onrender.com/health` (ej.: cron-job.org).

Si se pierde una clave: el superadmin resetea la de cualquier admin desde su panel.

Dominio propio: en Render → `navagenda-web` → *Custom domains* (después).
Si el nombre `navagenda-api` ya está tomado en Render, cambiá la URL del rewrite en `render.yaml`.
