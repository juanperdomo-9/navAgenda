"""Helpers compartidos por los tests de la API."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hashear_clave
from app.models import Barberia, Usuario

CLAVE = "una-clave-larga-1"


def crear_usuario(db: Session, usuario: str, rol: str = "admin", **extra) -> Usuario:
    """Crea un usuario del panel. Si es admin, también su barbería (slug b-<usuario>)."""
    barberia_id = None
    if rol == "admin":
        b = Barberia(nombre=f"Barbería {usuario}", slug=f"b-{usuario.lower()}")
        db.add(b)
        db.flush()
        barberia_id = b.id
    u = Usuario(
        nombre=usuario.title(),
        usuario=usuario,
        password_hash=hashear_clave(CLAVE),
        rol=rol,
        barberia_id=barberia_id,
        **extra,
    )
    db.add(u)
    db.flush()
    return u


def ingresar(client: TestClient, usuario: str, clave: str = CLAVE):
    return client.post("/auth/ingresar", json={"usuario": usuario, "clave": clave})
