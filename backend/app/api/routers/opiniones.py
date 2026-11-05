"""Opiniones en el panel: la barbería ve todas y elige cuáles se muestran en su página."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import DB, Admin
from app.models import Opinion
from app.services import almacen, opiniones

router = APIRouter(prefix="/panel", tags=["opiniones"])


def _opinion(db, admin, opinion_id: UUID) -> Opinion:
    o = db.scalar(
        select(Opinion).where(Opinion.id == opinion_id, Opinion.barberia_id == admin.barberia_id)
    )
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa opinión.")
    return o


@router.get("/opiniones")
def listar(admin: Admin, db: DB):
    lista = db.scalars(
        select(Opinion)
        .where(Opinion.barberia_id == admin.barberia_id)
        .order_by(Opinion.creado_en.desc())
    )
    return {
        "resumen": opiniones.para_pagina(db, admin.barberia_id),
        "lista": [opiniones.a_dict(db, o, completo=True) for o in lista],
    }


class Visible(BaseModel):
    visible: bool


@router.patch("/opiniones/{opinion_id}")
def mostrar(opinion_id: UUID, datos: Visible, admin: Admin, db: DB):
    o = _opinion(db, admin, opinion_id)
    o.visible = datos.visible
    db.commit()
    return opiniones.a_dict(db, o, completo=True)


@router.delete("/opiniones/{opinion_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar(opinion_id: UUID, admin: Admin, db: DB) -> None:
    o = _opinion(db, admin, opinion_id)
    if o.video_ruta and almacen.configurado():
        almacen.borrar(o.video_ruta)
    db.delete(o)
    db.commit()
