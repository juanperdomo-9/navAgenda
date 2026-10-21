"""Primera barbería real: Inspirationmen (La Plata). Se puede correr en producción.

Uso: uv run python -m app.cli cargar-inspirationmen
Crea la barbería, sus barberos con horario, sus servicios y su admin (usuario "inspirationmen")
con una clave temporal que se muestra una sola vez y hay que cambiar al entrar.
"""

from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import clave_temporal, hashear_clave
from app.models import (
    Barberia,
    Barbero,
    BarberoServicio,
    HorarioBarbero,
    ReglaBeneficio,
    Servicio,
    Usuario,
)

SLUG = "inspirationmen"
# Lunes a viernes de 12 a 18, sábado de 10 a 20, domingo cerrado (0 = lunes).
HORARIO = [*[(d, time(12), time(18)) for d in range(5)], (5, time(10), time(20))]
# Todos de 30 minutos (pedido de Juan, 2026-10-21).
SERVICIOS = {
    "vip": ("Peinado y corte VIP", 20000),
    "asesoramiento": ("Asesoramiento y corte de cabello", 25000),
    "mechas": ("Globales / Mechas", 60000),
}
BARBEROS = {
    "Agus Martín": ["vip"],
    "Agus Urquiza": ["vip"],
    "Thiago": ["asesoramiento", "vip", "mechas"],
}


def cargar(db: Session) -> str | None:
    """Devuelve la clave temporal del admin, o None si la barbería ya existía."""
    if db.scalar(select(Barberia.id).where(Barberia.slug == SLUG)):
        return None
    b = Barberia(
        nombre="Inspirationmen",
        slug=SLUG,
        color_acento="#0f0f0e",  # como su web (agus-martin-academy)
        direccion="Diagonal 74, frente a Oblicus Gym",
        ciudad="La Plata",
        horas_min_cancelacion=3,
    )
    db.add(b)
    db.flush()
    servicios = {
        k: Servicio(barberia_id=b.id, nombre=n, precio=p, duracion_min=30)
        for k, (n, p) in SERVICIOS.items()
    }
    db.add_all(servicios.values())
    db.flush()
    for nombre, hace in BARBEROS.items():
        barbero = Barbero(barberia_id=b.id, nombre=nombre)
        db.add(barbero)
        db.flush()
        db.add_all(
            HorarioBarbero(barbero_id=barbero.id, dia_semana=d, desde=a, hasta=h)
            for d, a, h in HORARIO
        )
        db.add_all(
            BarberoServicio(barbero_id=barbero.id, servicio_id=servicios[k].id, barberia_id=b.id)
            for k in hace
        )
    db.add(
        ReglaBeneficio(
            barberia_id=b.id,
            cada_x_cortes=5,
            tipo="servicio_gratis",
            servicio_id=servicios["vip"].id,
            descripcion="Cada 5 cortes, el siguiente Peinado y corte VIP es gratis",
        )
    )
    clave = clave_temporal()
    db.add(
        Usuario(
            barberia_id=b.id,
            nombre="Admin Inspirationmen",
            usuario=SLUG,
            password_hash=hashear_clave(clave),
            rol="admin",
            debe_cambiar_clave=True,
        )
    )
    db.flush()
    return clave
