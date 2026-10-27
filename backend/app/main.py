from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import (
    agenda,
    auth,
    health,
    logo,
    numeros,
    og,
    panel,
    publico,
    solicitudes,
    superadmin,
)
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="NavAgenda API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,  # la sesión del panel viaja en cookie httpOnly
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(superadmin.router)
    app.include_router(panel.router)
    app.include_router(publico.router)
    app.include_router(agenda.router)
    app.include_router(numeros.router)
    app.include_router(solicitudes.router)
    app.include_router(og.router)
    app.include_router(logo.router)
    # Próximas tareas: public (portal, página de la barbería y reservas)
    return app


app = create_app()
