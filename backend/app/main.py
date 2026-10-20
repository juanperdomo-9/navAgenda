from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import health
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
    # Próximas tareas: public (portal y reservas), auth, admin, superadmin
    return app


app = create_app()
