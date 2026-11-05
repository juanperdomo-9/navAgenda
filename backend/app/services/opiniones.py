"""Opiniones de clientes que fueron al turno: estrellas, texto y (opcional) un video corto.

Solo opina quien tiene un turno marcado "asistió", una vez por turno, desde el link de su ticket.
Las de 4 y 5 estrellas se publican solas; las de 1 a 3 quedan ocultas hasta que la barbería las
muestre. El video vive en Supabase Storage, como los de la galería.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Barbero, Cliente, Opinion, Servicio, Turno
from app.services import almacen

PUBLICA_SOLA_DESDE = 4


def de_turno(db: Session, t: Turno) -> Opinion | None:
    return db.scalar(select(Opinion).where(Opinion.turno_id == t.id))


def puede_opinar(db: Session, t: Turno) -> bool:
    return t.estado == "asistio" and de_turno(db, t) is None


def video_url(o: Opinion) -> str | None:
    return almacen.url_publica(o.video_ruta) if o.video_ruta and almacen.configurado() else None


def a_dict(db: Session, o: Opinion, completo: bool = False) -> dict:
    t = db.get(Turno, o.turno_id)
    c, x, s = (
        db.get(Cliente, t.cliente_id),
        db.get(Barbero, t.barbero_id),
        db.get(Servicio, t.servicio_id),
    )
    d = {
        "id": o.id,
        "nombre": c.nombre.split(" ")[0],
        "estrellas": o.estrellas,
        "texto": o.texto,
        "video_url": video_url(o),
        "barbero": x.nombre.split(" ")[0],
        "servicio": s.nombre,
        "fecha": o.creado_en,
    }
    if completo:  # panel: también lo que no se publica
        d |= {"visible": o.visible, "cliente": c.nombre, "telefono": c.telefono}
    return d


def para_pagina(db: Session, barberia_id) -> dict:
    """Promedio y cantidad (de las publicadas) y las últimas 12 para la página."""
    visibles = select(Opinion).where(Opinion.barberia_id == barberia_id, Opinion.visible)
    cant, prom = db.execute(
        select(func.count(Opinion.id), func.avg(Opinion.estrellas)).where(
            Opinion.barberia_id == barberia_id, Opinion.visible
        )
    ).one()
    lista = db.scalars(visibles.order_by(Opinion.creado_en.desc()).limit(12))
    return {
        "cantidad": cant,
        "promedio": round(float(prom), 1) if prom else None,
        "lista": [a_dict(db, o) for o in lista],
    }
