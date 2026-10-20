# NavAgenda

Plataforma de turnos online para barberías: portal con buscador y mapa, página pública por barbería,
reserva sin cuenta (nombre + teléfono) y panel de administración con grilla, fidelidad y dashboards.

El alcance completo y las reglas de negocio están en [CLAUDE.md](CLAUDE.md).

## Estructura

```
backend/    API en FastAPI (Python 3.12, uv)
frontend/   React + TypeScript + Vite + Tailwind v4
```

## Desarrollo

```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173  (sistema de diseño en /dev/design-system)

# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload   # http://localhost:8000/health
uv run pytest
```

Copiá `.env.example` como `.env` y completá los valores antes de conectar la base.
