from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.api.deps import DB, UsuarioActual
from app.core.config import get_settings
from app.core.security import COOKIE_SESION, crear_token, limite_login
from app.schemas.auth import CambioClave, Ingreso, UsuarioPanel
from app.services import auth as servicio

router = APIRouter(prefix="/auth", tags=["auth del panel"])


def _poner_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        COOKIE_SESION,
        token,
        max_age=s.sesion_horas * 3600,
        httponly=True,  # el JavaScript de la página no puede leerla
        secure=s.es_produccion,  # en producción solo viaja por HTTPS
        samesite="lax",  # no se manda en POST desde otros sitios (protege contra CSRF)
        path="/",
    )


@router.post("/ingresar", response_model=UsuarioPanel)
def ingresar(datos: Ingreso, request: Request, response: Response, db: DB):
    ip = request.client.host if request.client else "desconocida"
    if not limite_login.permitir(ip):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Demasiados intentos desde esta conexión. Esperá unos minutos y volvé a probar.",
        )
    try:
        usuario = servicio.ingresar(db, datos.usuario, datos.clave)
    except servicio.CuentaBloqueada as e:
        minutos = max(1, round((e.hasta - datetime.now(UTC)).total_seconds() / 60))
        raise HTTPException(
            status.HTTP_423_LOCKED,
            f"Por seguridad bloqueamos la cuenta un rato. Probá de nuevo en {minutos} min.",
        ) from None
    except servicio.IngresoInvalido:
        db.commit()  # guarda el intento fallido
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o clave incorrectos.") from None
    db.commit()
    _poner_cookie(response, crear_token(usuario.id, usuario.rol, usuario.barberia_id))
    return usuario


@router.post("/salir", status_code=status.HTTP_204_NO_CONTENT)
def salir(response: Response) -> None:
    response.delete_cookie(COOKIE_SESION, path="/")


@router.get("/yo", response_model=UsuarioPanel)
def yo(usuario: UsuarioActual):
    return usuario


@router.post("/cambiar-clave", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_clave(datos: CambioClave, usuario: UsuarioActual, db: DB) -> None:
    if datos.clave_nueva == datos.clave_actual:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "La clave nueva tiene que ser distinta."
        )
    try:
        servicio.cambiar_clave(db, usuario, datos.clave_actual, datos.clave_nueva)
    except servicio.IngresoInvalido:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "La clave actual no es correcta."
        ) from None
    db.commit()
