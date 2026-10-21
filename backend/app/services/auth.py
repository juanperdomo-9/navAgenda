"""Reglas de ingreso al panel: verificación de clave, bloqueo por intentos y cambio de clave."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import (
    MAX_INTENTOS,
    MINUTOS_BLOQUEO,
    hashear_clave,
    necesita_rehash,
    verificar_clave,
)
from app.models import Usuario


class IngresoInvalido(Exception):
    """Usuario o clave incorrectos. El mensaje es el mismo en ambos casos a propósito."""


class CuentaBloqueada(Exception):
    def __init__(self, hasta: datetime) -> None:
        self.hasta = hasta


def buscar_por_usuario(db: Session, usuario: str) -> Usuario | None:
    return db.scalar(select(Usuario).where(func.lower(Usuario.usuario) == usuario.strip().lower()))


def ingresar(db: Session, usuario: str, clave: str, ahora: datetime | None = None) -> Usuario:
    ahora = ahora or datetime.now(UTC)
    u = buscar_por_usuario(db, usuario)

    if u and u.bloqueado_hasta and u.bloqueado_hasta > ahora:
        raise CuentaBloqueada(u.bloqueado_hasta)

    # Se verifica aunque el usuario no exista (contra un hash falso): misma demora en ambos casos.
    ok = verificar_clave(clave, u.password_hash if u else None)
    if not u or not u.activo or not ok:
        if u:
            u.intentos_fallidos += 1
            if u.intentos_fallidos >= MAX_INTENTOS:
                u.bloqueado_hasta = ahora + timedelta(minutes=MINUTOS_BLOQUEO)
                u.intentos_fallidos = 0
            db.flush()
        raise IngresoInvalido

    u.intentos_fallidos = 0
    u.bloqueado_hasta = None
    u.ultimo_ingreso = ahora
    if necesita_rehash(u.password_hash):
        u.password_hash = hashear_clave(clave)
    db.flush()
    return u


def cambiar_clave(db: Session, u: Usuario, actual: str, nueva: str) -> None:
    if not verificar_clave(actual, u.password_hash):
        raise IngresoInvalido
    u.password_hash = hashear_clave(nueva)
    u.debe_cambiar_clave = False
    db.flush()
