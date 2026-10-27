"""Panel del admin de barbería: configuración, barberos (con horarios y días libres) y servicios.

Cada endpoint trabaja solo sobre la barbería del admin logueado (admin.barberia_id).
Un id de otra barbería responde 404, igual que uno que no existe.
"""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DB, Admin
from app.models import Barberia, Barbero, Bloqueo, ReglaBeneficio, Servicio
from app.schemas.panel import (
    BarberoCambios,
    BarberoNuevo,
    BarberoOut,
    BarberosDelServicio,
    BloqueoNuevo,
    BloqueoOut,
    ConfigBarberia,
    ConfigCambios,
    Horarios,
    ServicioCambios,
    ServicioNuevo,
    ServicioOut,
    ServiciosDelBarbero,
)
from app.services import panel as svc

router = APIRouter(prefix="/panel", tags=["panel de la barbería"])

NO_EXISTE_BARBERO = HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese barbero.")
NO_EXISTE_SERVICIO = HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese servicio.")


def _barbero(db, admin, barbero_id: UUID) -> Barbero:
    try:
        return svc.barbero_de(db, admin.barberia_id, barbero_id)
    except svc.NoEncontrado:
        raise NO_EXISTE_BARBERO from None


def _servicio(db, admin, servicio_id: UUID) -> Servicio:
    try:
        return svc.servicio_de(db, admin.barberia_id, servicio_id)
    except svc.NoEncontrado:
        raise NO_EXISTE_SERVICIO from None


# ─── Configuración de la página ───


@router.get("/barberia", response_model=ConfigBarberia)
def ver_config(admin: Admin, db: DB):
    return db.get(Barberia, admin.barberia_id)


@router.patch("/barberia", response_model=ConfigBarberia)
def cambiar_config(datos: ConfigCambios, admin: Admin, db: DB):
    b = db.get(Barberia, admin.barberia_id)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(b, campo, valor)
    db.commit()
    return b


# ─── Barberos ───


@router.get("/barberos", response_model=list[BarberoOut])
def listar_barberos(admin: Admin, db: DB):
    barberos = db.scalars(
        select(Barbero)
        .where(Barbero.barberia_id == admin.barberia_id)
        .order_by(Barbero.activo.desc(), Barbero.nombre)
    ).all()
    return [svc.barbero_out(db, b) for b in barberos]


@router.post("/barberos", response_model=BarberoOut, status_code=status.HTTP_201_CREATED)
def crear_barbero(datos: BarberoNuevo, admin: Admin, db: DB):
    b = svc.crear_barbero(db, admin.barberia_id, datos.nombre, datos.foto_url, datos.horarios)
    db.commit()
    return svc.barbero_out(db, b)


@router.get("/barberos/{barbero_id}", response_model=BarberoOut)
def ver_barbero(barbero_id: UUID, admin: Admin, db: DB):
    return svc.barbero_out(db, _barbero(db, admin, barbero_id))


@router.patch("/barberos/{barbero_id}", response_model=BarberoOut)
def cambiar_barbero(barbero_id: UUID, datos: BarberoCambios, admin: Admin, db: DB):
    b = _barbero(db, admin, barbero_id)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(b, campo, valor.strip() if isinstance(valor, str) else valor)
    db.commit()
    return svc.barbero_out(db, b)


@router.delete("/barberos/{barbero_id}", status_code=status.HTTP_204_NO_CONTENT)
def dar_de_baja_barbero(barbero_id: UUID, admin: Admin, db: DB) -> None:
    """Baja lógica: se conserva su historial y deja de aparecer para reservar."""
    _barbero(db, admin, barbero_id).activo = False
    db.commit()


@router.put("/barberos/{barbero_id}/horarios", response_model=BarberoOut)
def cambiar_horarios(barbero_id: UUID, datos: Horarios, admin: Admin, db: DB):
    b = _barbero(db, admin, barbero_id)
    svc.reemplazar_horarios(db, b, datos.horarios)
    db.commit()
    return svc.barbero_out(db, b)


@router.put("/barberos/{barbero_id}/servicios", response_model=BarberoOut)
def cambiar_servicios_del_barbero(
    barbero_id: UUID, datos: ServiciosDelBarbero, admin: Admin, db: DB
):
    b = _barbero(db, admin, barbero_id)
    try:
        svc.asignar_servicios(db, b, datos.servicio_ids)
    except svc.ServicioAjeno:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Alguno de esos servicios no es de tu barbería."
        ) from None
    db.commit()
    return svc.barbero_out(db, b)


# ─── Días libres (bloqueos) ───


@router.get("/barberos/{barbero_id}/bloqueos", response_model=list[BloqueoOut])
def listar_bloqueos(barbero_id: UUID, admin: Admin, db: DB):
    """Bloqueos que todavía no terminaron."""
    b = _barbero(db, admin, barbero_id)
    return db.scalars(
        select(Bloqueo)
        .where(Bloqueo.barbero_id == b.id, Bloqueo.fin > datetime.now(UTC))
        .order_by(Bloqueo.inicio)
    ).all()


@router.post(
    "/barberos/{barbero_id}/bloqueos",
    response_model=BloqueoOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_bloqueo(barbero_id: UUID, datos: BloqueoNuevo, admin: Admin, db: DB):
    b = _barbero(db, admin, barbero_id)
    bl = Bloqueo(
        barberia_id=admin.barberia_id,
        barbero_id=b.id,
        inicio=datos.inicio.astimezone(UTC),
        fin=datos.fin.astimezone(UTC),
        motivo=datos.motivo,
    )
    db.add(bl)
    db.commit()
    return bl


@router.delete("/bloqueos/{bloqueo_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_bloqueo(bloqueo_id: UUID, admin: Admin, db: DB) -> None:
    try:
        bl = svc.bloqueo_de(db, admin.barberia_id, bloqueo_id)
    except svc.NoEncontrado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese bloqueo.") from None
    db.delete(bl)
    db.commit()


# ─── Servicios ───


@router.get("/servicios", response_model=list[ServicioOut])
def listar_servicios(admin: Admin, db: DB):
    servicios = db.scalars(
        select(Servicio)
        .where(Servicio.barberia_id == admin.barberia_id)
        .order_by(Servicio.activo.desc(), Servicio.nombre)
    ).all()
    return [svc.servicio_out(db, s) for s in servicios]


@router.post("/servicios", response_model=ServicioOut, status_code=status.HTTP_201_CREATED)
def crear_servicio(datos: ServicioNuevo, admin: Admin, db: DB):
    s = svc.crear_servicio(db, admin.barberia_id, datos.nombre, datos.precio, datos.duracion_min)
    db.commit()
    return svc.servicio_out(db, s)


@router.patch("/servicios/{servicio_id}", response_model=ServicioOut)
def cambiar_servicio(servicio_id: UUID, datos: ServicioCambios, admin: Admin, db: DB):
    """Cambiar el precio no toca los turnos ya reservados: cada turno guarda su precio."""
    s = _servicio(db, admin, servicio_id)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(s, campo, valor.strip() if isinstance(valor, str) else valor)
    db.commit()
    return svc.servicio_out(db, s)


@router.put("/servicios/{servicio_id}/barberos", response_model=ServicioOut)
def cambiar_barberos_del_servicio(
    servicio_id: UUID, datos: BarberosDelServicio, admin: Admin, db: DB
):
    s = _servicio(db, admin, servicio_id)
    try:
        svc.asignar_barberos(db, s, datos.barbero_ids)
    except svc.BarberoAjeno:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Alguno de esos barberos no es de tu barbería."
        ) from None
    db.commit()
    return svc.servicio_out(db, s)


@router.delete("/servicios/{servicio_id}", status_code=status.HTTP_204_NO_CONTENT)
def dar_de_baja_servicio(servicio_id: UUID, admin: Admin, db: DB) -> None:
    _servicio(db, admin, servicio_id).activo = False
    db.commit()


# ─── Tarjeta de cortes (regla de fidelidad) ───


class PremioRuleta(BaseModel):
    texto: str = Field(min_length=2, max_length=60)
    descuento_pct: int = Field(ge=0, le=100)  # 100 = gratis; 0 = sin descuento (ej. un producto)


class ReglaIn(BaseModel):
    cada_x_cortes: int = Field(ge=1, le=20)
    modo: Literal["fijo", "ruleta"] = "fijo"
    ruleta: list[PremioRuleta] = Field(default_factory=list, max_length=12)
    tipo: Literal["descuento_pct", "descuento_monto", "servicio_gratis", "texto"]
    valor: int | None = Field(default=None, ge=1, le=10_000_000)
    servicio_id: UUID | None = None
    descripcion: str = Field(min_length=3, max_length=120)


def _regla_out(r: ReglaBeneficio | None) -> dict | None:
    if not r:
        return None
    return {
        "cada_x_cortes": r.cada_x_cortes,
        "tipo": r.tipo,
        "valor": r.valor,
        "servicio_id": r.servicio_id,
        "descripcion": r.descripcion,
        "modo": r.modo,
        "ruleta": r.ruleta,
    }


@router.get("/fidelidad")
def ver_regla(admin: Admin, db: DB):
    return _regla_out(
        db.scalar(
            select(ReglaBeneficio).where(
                ReglaBeneficio.barberia_id == admin.barberia_id, ReglaBeneficio.activa
            )
        )
    )


@router.put("/fidelidad")
def cambiar_regla(datos: ReglaIn, admin: Admin, db: DB):
    """Reemplaza la regla activa (la anterior queda guardada, inactiva). Las tarjetas siguen."""
    if datos.modo == "ruleta" and len(datos.ruleta) < 2:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "La ruleta necesita al menos 2 premios."
        )
    if datos.modo == "ruleta":  # los premios salen de la ruleta, no de tipo/valor
        datos.tipo, datos.valor, datos.servicio_id = "texto", None, None
    if datos.tipo == "servicio_gratis":
        if not datos.servicio_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Elegí qué servicio es gratis."
            )
        _servicio(db, admin, datos.servicio_id)
    if datos.tipo in ("descuento_pct", "descuento_monto") and not datos.valor:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Poné el valor del descuento.")
    if datos.tipo == "descuento_pct" and datos.valor > 100:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El descuento va de 1 a 100%.")
    for r in db.scalars(
        select(ReglaBeneficio).where(
            ReglaBeneficio.barberia_id == admin.barberia_id, ReglaBeneficio.activa
        )
    ):
        r.activa = False
    db.flush()
    nueva = ReglaBeneficio(
        barberia_id=admin.barberia_id,
        cada_x_cortes=datos.cada_x_cortes,
        tipo=datos.tipo,
        valor=datos.valor if datos.tipo != "servicio_gratis" else None,
        servicio_id=datos.servicio_id if datos.tipo == "servicio_gratis" else None,
        descripcion=datos.descripcion.strip(),
        modo=datos.modo,
        ruleta=[p.model_dump() for p in datos.ruleta] if datos.modo == "ruleta" else [],
    )
    db.add(nueva)
    db.commit()
    return _regla_out(nueva)
