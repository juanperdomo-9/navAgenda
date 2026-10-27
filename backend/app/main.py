from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import (
    agenda,
    auth,
    cobranza,
    health,
    logo,
    numeros,
    og,
    paginas,
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
    app.include_router(paginas.router)
    app.include_router(cobranza.router)
    if settings.es_produccion:
        _revisar_deudas_cada_hora()
    return app


def _revisar_deudas_cada_hora() -> None:
    """Pausa por deuda aunque nadie abra el panel (una sola instancia: alcanza un hilo)."""
    import threading

    from sqlalchemy.orm import Session

    from app.db.session import get_engine

    def tarea() -> None:
        try:
            with Session(get_engine()) as db:
                cobranza.pausar_vencidas(db)
        except Exception:  # noqa: BLE001 (que un error no corte el ciclo)
            pass
        t = threading.Timer(3600, tarea)
        t.daemon = True
        t.start()

    primera = threading.Timer(60, tarea)
    primera.daemon = True
    primera.start()


app = create_app()
