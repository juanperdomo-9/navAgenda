"""'Quiero sumar mi barbería': el formulario público y la bandeja del superadmin."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DB, Superadmin
from app.api.routers.publico import normalizar_telefono
from app.core.security import LimitePorIP
from app.models import Solicitud

router = APIRouter(tags=["solicitudes"])
limite_solicitudes = LimitePorIP(maximo=3, segundos=60 * 60)


class SolicitudIn(BaseModel):
    barberia: str = Field(min_length=2, max_length=80)
    nombre: str = Field(min_length=2, max_length=60)
    telefono: str = Field(min_length=8, max_length=24)
    barrio: str | None = Field(default=None, max_length=80)
    mensaje: str | None = Field(default=None, max_length=500)


def _out(s: Solicitud) -> dict:
    return {
        "id": s.id,
        "barberia": s.barberia,
        "nombre": s.nombre,
        "telefono": s.telefono,
        "barrio": s.barrio,
        "mensaje": s.mensaje,
        "estado": s.estado,
        "creado_en": s.creado_en,
    }


@router.post("/p/solicitudes", status_code=status.HTTP_201_CREATED)
def pedir_alta(datos: SolicitudIn, request: Request, db: DB):
    if not limite_solicitudes.permitir(request.client.host if request.client else "?"):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Ya nos llegó tu pedido. Te escribimos pronto."
        )
    tel = normalizar_telefono(datos.telefono)
    if not tel:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Revisá el teléfono: con código de área, sin 0 ni 15. Ej.: 221 456 7890.",
        )
    s = Solicitud(
        barberia=datos.barberia.strip(),
        nombre=datos.nombre.strip(),
        telefono=tel,
        barrio=(datos.barrio or "").strip() or None,
        mensaje=(datos.mensaje or "").strip() or None,
    )
    db.add(s)
    db.commit()
    return {"ok": True}


@router.get("/super/solicitudes")
def listar(_: Superadmin, db: DB):
    return [
        _out(s)
        for s in db.scalars(
            select(Solicitud)
            .where(Solicitud.estado == "pendiente")
            .order_by(Solicitud.creado_en.desc())
        )
    ]


class Estado(BaseModel):
    estado: Literal["pendiente", "creada", "descartada"]


@router.patch("/super/solicitudes/{solicitud_id}")
def cambiar(solicitud_id: UUID, datos: Estado, _: Superadmin, db: DB):
    s = db.get(Solicitud, solicitud_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa solicitud.")
    s.estado = datos.estado
    db.commit()
    return _out(s)
