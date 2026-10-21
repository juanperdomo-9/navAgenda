"""Datos de ejemplo para desarrollo: barberías de La Plata con barberos, servicios, horarios,
regla de beneficio y un admin por barbería.

Son ILUSTRATIVOS: las barberías, los barberos y los precios no son reales.
Cada admin entra con usuario = slug de su barbería y la clave de SEED_CLAVE_ADMIN
(por defecto "navagenda-dev-2026"). Nunca se corre en producción.

Uso: uv run python -m app.db.seed   (las barberías que ya existen no se tocan)
"""

import os
from dataclasses import dataclass, field
from datetime import time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hashear_clave
from app.models import (
    Barberia,
    Barbero,
    BarberoServicio,
    HorarioBarbero,
    ReglaBeneficio,
    Servicio,
    Usuario,
)

SLUG = "la-navaja"  # la barbería principal de ejemplo
CLAVE_ADMIN_DEV = "navagenda-dev-2026"

LUN, MAR, MIE, JUE, VIE, SAB = range(6)
SEMANA = (LUN, MAR, MIE, JUE, VIE)
Tramos = list[tuple[int, time, time]]


def corrido(dias: tuple[int, ...], desde: int, hasta: int) -> Tramos:
    return [(d, time(desde), time(hasta)) for d in dias]


def cortado(dias: tuple[int, ...]) -> Tramos:
    """Horario cortado típico: 10 a 13 y 16 a 20."""
    return corrido(dias, 10, 13) + corrido(dias, 16, 20)


@dataclass
class Ejemplo:
    slug: str
    nombre: str
    barrio: str
    direccion: str
    lat: str
    lng: str
    color: str
    barberos: dict[str, Tramos]
    # (nombre, precio en pesos, duración en minutos)
    servicios: list[tuple[str, int, int]] = field(
        default_factory=lambda: [
            ("Corte", 12000, 30),
            ("Corte + barba", 14500, 45),
            ("Barba", 7000, 20),
            ("Perfilado de cejas", 4000, 15),
        ]
    )
    cada_x: int = 5


BARBERIAS: list[Ejemplo] = [
    Ejemplo(
        SLUG,
        "La Navaja",
        "Centro",
        "Calle 8 e/ 49 y 50",
        "-34.919500",
        "-57.953000",
        "#c9a46a",
        {
            "Martín Sosa": cortado(SEMANA) + corrido((SAB,), 10, 15),
            "Lucas Ferreyra": corrido((MAR, MIE, JUE, VIE, SAB), 11, 20),
            "Tomás Ibarra": corrido((*SEMANA, SAB), 10, 19),
        },
    ),
    Ejemplo(
        "barberia-plaza-italia",
        "Barbería Plaza Italia",
        "Plaza Italia",
        "Diagonal 77 e/ 6 y 7",
        "-34.910500",
        "-57.956000",
        "#c47f57",
        {"Federico Ruiz": corrido(SEMANA, 9, 18), "Agustina Paz": corrido((MAR, JUE, SAB), 10, 19)},
        [("Corte", 11000, 30), ("Corte + barba", 13500, 45), ("Barba", 6500, 20)],
    ),
    Ejemplo(
        "tijera-siete",
        "Tijera Siete",
        "Centro",
        "Calle 7 e/ 45 y 46",
        "-34.912500",
        "-57.948000",
        "#d4a24c",
        {
            "Nicolás Gómez": cortado((*SEMANA, SAB)),
            "Bruno Acosta": corrido((LUN, MIE, VIE, SAB), 12, 20),
            "Ramiro Díaz": corrido(SEMANA, 10, 18),
        },
        [
            ("Corte", 13000, 30),
            ("Corte + barba", 16000, 50),
            ("Barba", 7500, 20),
            ("Color", 22000, 60),
        ],
    ),
    Ejemplo(
        "barberia-del-bosque",
        "Barbería del Bosque",
        "Bosque",
        "Calle 1 e/ 59 y 60",
        "-34.918000",
        "-57.937000",
        "#b8925a",
        {
            "Leandro Vega": corrido((*SEMANA, SAB), 10, 19),
            "Iván Molina": corrido((MIE, JUE, VIE, SAB), 13, 21),
        },
        cada_x=6,
    ),
    Ejemplo(
        "tolosa-cortes",
        "Tolosa Cortes",
        "Tolosa",
        "Calle 1 e/ 527 y 528",
        "-34.896500",
        "-57.970000",
        "#c9a46a",
        {
            "Matías Herrera": cortado(SEMANA),
            "Joaquín Romero": corrido((MAR, MIE, JUE, VIE, SAB), 10, 18),
        },
        [("Corte", 9500, 30), ("Corte + barba", 12000, 45), ("Barba", 6000, 20)],
    ),
    Ejemplo(
        "gonnet-barber-club",
        "Gonnet Barber Club",
        "Gonnet",
        "Camino Centenario e/ 501 y 502",
        "-34.880000",
        "-58.015000",
        "#c47f57",
        {
            "Santiago López": corrido((*SEMANA, SAB), 10, 20),
            "Emiliano Castro": corrido((LUN, MAR, MIE, JUE), 14, 21),
            "Valentín Sosa": corrido((VIE, SAB), 9, 17),
        },
        [
            ("Corte", 14000, 30),
            ("Corte + barba", 17500, 50),
            ("Barba", 8000, 25),
            ("Perfilado de cejas", 4500, 15),
        ],
    ),
    Ejemplo(
        "city-bell-barberia",
        "City Bell Barbería",
        "City Bell",
        "Calle 14 (Cantilo) e/ 473 y 474",
        "-34.869000",
        "-58.047000",
        "#d4a24c",
        {
            "Gonzalo Peralta": cortado((*SEMANA, SAB)),
            "Franco Medina": corrido((MIE, JUE, VIE, SAB), 11, 20),
        },
    ),
    Ejemplo(
        "los-hornos-barber",
        "Los Hornos Barber",
        "Los Hornos",
        "Calle 66 e/ 143 y 144",
        "-34.958000",
        "-57.980000",
        "#b8925a",
        {"Diego Benítez": corrido((*SEMANA, SAB), 9, 19)},
        [("Corte", 8500, 30), ("Corte + barba", 11000, 45), ("Barba", 5500, 20)],
        cada_x=4,
    ),
]


def _crear(db: Session, e: Ejemplo, clave_hash: str) -> Barberia:
    barberia = Barberia(
        nombre=e.nombre,
        slug=e.slug,
        color_acento=e.color,
        direccion=e.direccion,
        ciudad="La Plata",
        barrio=e.barrio,
        lat=Decimal(e.lat),
        lng=Decimal(e.lng),
        horas_min_cancelacion=3,
        descripcion="Barbería de ejemplo para desarrollo.",
    )
    db.add(barberia)
    db.flush()

    servicios = [
        Servicio(barberia_id=barberia.id, nombre=n, precio=p, duracion_min=d)
        for n, p, d in e.servicios
    ]
    db.add_all(servicios)
    barberos = []
    for nombre, tramos in e.barberos.items():
        barbero = Barbero(barberia_id=barberia.id, nombre=nombre)
        db.add(barbero)
        db.flush()
        db.add_all(
            HorarioBarbero(barbero_id=barbero.id, dia_semana=d, desde=a, hasta=h)
            for d, a, h in tramos
        )
        barberos.append(barbero)
    db.flush()

    # Al crear un barbero se le asignan todos los servicios (regla del CLAUDE.md).
    db.add_all(
        BarberoServicio(barbero_id=b.id, servicio_id=s.id, barberia_id=barberia.id)
        for b in barberos
        for s in servicios
    )
    db.add(
        ReglaBeneficio(
            barberia_id=barberia.id,
            cada_x_cortes=e.cada_x,
            tipo="servicio_gratis",
            servicio_id=servicios[0].id,
            descripcion=f"Cada {e.cada_x} cortes, el siguiente corte es gratis",
        )
    )
    db.add(
        Usuario(
            barberia_id=barberia.id,
            nombre=f"Admin {e.nombre}",
            usuario=e.slug,
            password_hash=clave_hash,
            rol="admin",
        )
    )
    db.flush()
    return barberia


def sembrar(db: Session) -> list[Barberia]:
    """Crea las barberías de ejemplo que todavía no existen. Devuelve las creadas."""
    if get_settings().es_produccion:
        raise RuntimeError("Los datos de ejemplo no se cargan en producción.")
    existentes = set(db.scalars(select(Barberia.slug)))
    pendientes = [e for e in BARBERIAS if e.slug not in existentes]
    if not pendientes:
        return []
    clave_hash = hashear_clave(os.environ.get("SEED_CLAVE_ADMIN", CLAVE_ADMIN_DEV))
    return [_crear(db, e, clave_hash) for e in pendientes]


def main() -> None:
    from app.db.session import get_engine

    with Session(get_engine()) as db, db.begin():
        creadas = sembrar(db)
    if creadas:
        print(f"Listo: {len(creadas)} barberías de ejemplo en La Plata.")
        print(
            "Cada admin entra con usuario = slug de su barbería (la clave está en app/db/seed.py)."
        )
    else:
        print("Las barberías de ejemplo ya existen: no se cambió nada.")


if __name__ == "__main__":
    main()
