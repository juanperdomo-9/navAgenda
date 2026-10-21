# Publicar NavAgenda (Render + Supabase)

1. **Supabase**: creá un proyecto (región São Paulo). En *Project Settings → Database → Connection string → URI*,
   copiá la del **Session pooler** y cambiá el comienzo `postgresql://` por `postgresql+psycopg://`.
2. **Render**: *New → Blueprint* y elegí este repo (usa `render.yaml`). Cuando te pida `DATABASE_URL`, pegá la de Supabase.
   Al terminar quedan `navagenda-api` y `navagenda-web`. Las migraciones se aplican solas al arrancar la API.
3. **Cargar Inspirationmen**: en Render → `navagenda-api` → *Shell*:
   `uv run python -m app.cli cargar-inspirationmen` (muestra la clave temporal del admin `inspirationmen`).
4. **Tu superadmin**: en la misma Shell:
   `uv run python -m app.cli crear-superadmin juan "Juan Perdomo" --generar` (muestra tu clave temporal).
5. Entrá a `https://navagenda-web.onrender.com/panel/ingresar`, cambiá la clave, y probá
   `https://navagenda-web.onrender.com/inspirationmen`.

Dominio propio: en Render → `navagenda-web` → *Custom domains* (después).
Si el nombre `navagenda-api` ya está tomado en Render, cambiá la URL del rewrite en `render.yaml`.
