"""Datos de ejemplo para desarrollo: 1 barbería, 3 barberos, 4 servicios y una regla de beneficio.

Son ILUSTRATIVOS: la barbería, los barberos y los precios no son reales.
Uso: uv run python -m app.db.seed   (si la barbería de ejemplo ya existe, no hace nada)
"""

from datetime import time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Barberia,
    Barbero,
    BarberoServicio,
    HorarioBarbero,
    ReglaBeneficio,
    Servicio,
)

SLUG = "la-navaja"

# (nombre, precio en pesos, duración en minutos)
SERVICIOS = [
    ("Corte", 12000, 30),
    ("Corte + barba", 14500, 45),
    ("Barba", 7000, 20),
    ("Perfilado de cejas", 4000, 15),
]

LUN, MAR, MIE, JUE, VIE, SAB = range(6)

# nombre → tramos (día, desde, hasta). Varios tramos por día = horario cortado.
BARBEROS: dict[str, list[tuple[int, time, time]]] = {
    "Martín Sosa": [
        *[(d, time(10), time(14)) for d in (LUN, MAR, MIE, JUE, VIE)],
        *[(d, time(15), time(20)) for d in (LUN, MAR, MIE, JUE, VIE)],
        (SAB, time(10), time(15)),
    ],
    "Lucas Ferreyra": [(d, time(11), time(20)) for d in (MAR, MIE, JUE, VIE, SAB)],
    "Tomás Ibarra": [(d, time(10), time(19)) for d in (LUN, MAR, MIE, JUE, VIE, SAB)],
}


def sembrar(db: Session) -> Barberia | None:
    """Crea los datos de ejemplo. Devuelve la barbería creada, o None si ya existía."""
    if db.scalar(select(Barberia).where(Barberia.slug == SLUG)):
        return None

    barberia = Barberia(
        nombre="La Navaja",
        slug=SLUG,
        color_acento="#c9a46a",
        direccion="Gorriti 4820",
        ciudad="Buenos Aires",
        barrio="Palermo",
        lat=Decimal("-34.588500"),
        lng=Decimal("-58.430000"),
        descripcion="Barbería de ejemplo para desarrollo.",
        horas_min_cancelacion=3,
    )
    db.add(barberia)
    db.flush()

    servicios = [
        Servicio(barberia_id=barberia.id, nombre=n, precio=p, duracion_min=d)
        for n, p, d in SERVICIOS
    ]
    db.add_all(servicios)

    barberos = []
    for nombre, tramos in BARBEROS.items():
        barbero = Barbero(barberia_id=barberia.id, nombre=nombre)
        db.add(barbero)
        db.flush()
        db.add_all(
            HorarioBarbero(barbero_id=barbero.id, dia_semana=d, desde=desde, hasta=hasta)
            for d, desde, hasta in tramos
        )
        barberos.append(barbero)
    db.flush()

    # Al crear un barbero se le asignan todos los servicios (regla del CLAUDE.md).
    db.add_all(
        BarberoServicio(barbero_id=b.id, servicio_id=s.id, barberia_id=barberia.id)
        for b in barberos
        for s in servicios
    )

    corte = servicios[0]
    db.add(
        ReglaBeneficio(
            barberia_id=barberia.id,
            cada_x_cortes=5,
            tipo="servicio_gratis",
            servicio_id=corte.id,
            descripcion="Cada 5 cortes, el siguiente corte es gratis",
        )
    )
    db.flush()
    return barberia


def main() -> None:
    from app.db.session import get_engine

    with Session(get_engine()) as db, db.begin():
        barberia = sembrar(db)
    if barberia:
        print(f"Listo: barbería de ejemplo '{SLUG}' con 3 barberos y 4 servicios.")
    else:
        print(f"La barbería de ejemplo '{SLUG}' ya existe: no se cambió nada.")


if __name__ == "__main__":
    main()
