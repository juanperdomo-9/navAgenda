# Publicar NavAgenda (Render + Supabase)

1. **Supabase**: creá un proyecto (región São Paulo). En *Project Settings → Database → Connection string → URI*,
   copiá la del **Session pooler** y cambiá el comienzo `postgresql://` por `postgresql+psycopg://`.
2. **Render**: *New → Blueprint* y elegí este repo (usa `render.yaml`). Cuando te pida `DATABASE_URL`, pegá la de Supabase.
   Al terminar quedan `navagenda-api` y `navagenda-web`. Las migraciones se aplican solas al arrancar la API.
3. **Cargar Inspirationmen y tu superadmin** (plan free: sin Shell, se corre desde tu compu contra Supabase).
   Esperá a que `navagenda-api` termine el primer deploy (crea las tablas). Después, en PowerShell:
   ```powershell
   cd E:derHouseNavAgendabackend
   $env:DATABASE_URL = "<la de Supabase, con postgresql+psycopg://>"
   uv run python -m app.cli cargar-inspirationmen
   uv run python -m app.cli crear-superadmin juan "Juan Perdomo" --generar
   Remove-Item Env:DATABASE_URL
   ```
   Cada comando muestra una clave temporal (la del admin `inspirationmen` y la tuya).
4. Plan free: la API se duerme a los 15 min sin uso (el primero espera ~50 s). Opcional: un ping gratis cada
   10 min a `https://navagenda-api.onrender.com/health` (ej.: cron-job.org).
5. Entrá a `https://navagenda-web.onrender.com/panel/ingresar`, cambiá la clave, y probá
   `https://navagenda-web.onrender.com/inspirationmen`.

Dominio propio: en Render → `navagenda-web` → *Custom domains* (después).
Si el nombre `navagenda-api` ya está tomado en Render, cambiá la URL del rewrite en `render.yaml`.
