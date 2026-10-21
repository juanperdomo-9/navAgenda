"""Dependencias compartidas: sesión de base y usuario del panel autenticado."""

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import COOKIE_SESION, leer_token
from app.db.session import get_db
from app.models import Usuario

DB = Annotated[Session, Depends(get_db)]

NO_AUTENTICADO = HTTPException(status.HTTP_401_UNAUTHORIZED, "Tenés que ingresar al panel.")


def usuario_actual(
    db: DB, sesion: Annotated[str | None, Cookie(alias=COOKIE_SESION)] = None
) -> Usuario:
    """El usuario de la cookie de sesión. Se relee de la base en cada request, así una baja
    o un cambio de rol se aplica al instante aunque el token siga vigente."""
    datos = leer_token(sesion) if sesion else None
    if not datos:
        raise NO_AUTENTICADO
    usuario = db.get(Usuario, UUID(datos["sub"]))
    if not usuario or not usuario.activo:
        raise NO_AUTENTICADO
    return usuario


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]


def requiere_rol(*roles: str) -> Callable[[Usuario], Usuario]:
    def _dep(usuario: UsuarioActual) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés permiso para esto.")
        if usuario.debe_cambiar_clave:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Antes de seguir tenés que cambiar tu clave temporal."
            )
        return usuario

    return _dep


Superadmin = Annotated[Usuario, Depends(requiere_rol("superadmin"))]
# El admin solo trabaja sobre su barbería: los endpoints del panel filtran por usuario.barberia_id.
Admin = Annotated[Usuario, Depends(requiere_rol("admin"))]
