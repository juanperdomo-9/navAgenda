"""Clientes (por teléfono, con bloqueo) y Números (facturación por período) del panel."""

from datetime import date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select

from app.api.deps import DB, Admin
from app.core.tz import ZONA_AR
from app.models import Barbero, Cliente, Fidelidad, Servicio, Turno

router = APIRouter(prefix="/panel", tags=["numeros"])


def _cuenta(estado: str, *extra):
    return func.count(Turno.id).filter(and_(Turno.estado == estado, *extra))


@router.get("/clientes")
def listar_clientes(admin: Admin, db: DB):
    filas = db.execute(
        select(
            Cliente,
            _cuenta("asistio"),
            _cuenta("no_asistio"),
            _cuenta("asistio", Turno.beneficio_aplicado),
            func.max(Turno.inicio),
            Fidelidad.cortes_acumulados,
            Fidelidad.beneficios_disponibles,
        )
        .outerjoin(Turno, Turno.cliente_id == Cliente.id)
        .outerjoin(Fidelidad, Fidelidad.cliente_id == Cliente.id)
        .where(Cliente.barberia_id == admin.barberia_id)
        .group_by(Cliente.id, Fidelidad.cliente_id)
        .order_by(_cuenta("asistio").desc(), Cliente.nombre)
    ).all()
    return [
        {
            "id": c.id,
            "nombre": c.nombre,
            "telefono": c.telefono,
            "bloqueado": c.bloqueado,
            "visitas": vis,
            "ausencias": aus,
            "premios_usados": usados,
            "ultimo_turno": ult,
            "cortes": cortes or 0,
            "premios": premios or 0,
        }
        for c, vis, aus, usados, ult, cortes, premios in filas
    ]


class Bloqueo(BaseModel):
    bloqueado: bool


@router.patch("/clientes/{cliente_id}")
def bloquear_cliente(cliente_id: UUID, datos: Bloqueo, admin: Admin, db: DB):
    c = db.scalar(
        select(Cliente).where(Cliente.id == cliente_id, Cliente.barberia_id == admin.barberia_id)
    )
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese cliente.")
    c.bloqueado = datos.bloqueado
    db.commit()
    return {"id": c.id, "bloqueado": c.bloqueado}


@router.get("/numeros")
def numeros(
    admin: Admin,
    db: DB,
    hasta: date,
    desde: date | None = None,
    barbero_id: UUID | None = None,
):
    """Totales entre dos días (inclusive, hora argentina). Solo "asistió" suma a lo facturado.

    Sin `desde`: desde el primer turno de la barbería ("todo"). Rangos de más de 62 días se
    agrupan por mes en `por_periodo`; si no, por día.
    """
    if desde is None:
        primero = db.scalar(
            select(func.min(Turno.inicio)).where(Turno.barberia_id == admin.barberia_id)
        )
        desde = min(primero.astimezone(ZONA_AR).date(), hasta) if primero else hasta
    if hasta < desde:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Rango de fechas inválido.")
    ini = datetime.combine(desde, time(0), tzinfo=ZONA_AR)
    fin = datetime.combine(hasta + timedelta(days=1), time(0), tzinfo=ZONA_AR)
    q = select(Turno).where(
        Turno.barberia_id == admin.barberia_id,
        Turno.inicio >= ini,
        Turno.inicio < fin,
        Turno.estado.in_(("asistio", "no_asistio")),
    )
    if barbero_id:
        q = q.where(Turno.barbero_id == barbero_id)
    turnos = db.scalars(q).all()
    barberos = db.scalars(
        select(Barbero).where(Barbero.barberia_id == admin.barberia_id).order_by(Barbero.nombre)
    ).all()
    servicios = {
        s.id: s.nombre
        for s in db.scalars(select(Servicio).where(Servicio.barberia_id == admin.barberia_id))
    }

    por_mes = (hasta - desde).days > 62
    clave = (lambda d: d.isoformat()[:7]) if por_mes else (lambda d: d.isoformat())
    por_periodo: dict[str, int] = {}
    d = desde
    while d <= hasta:
        por_periodo.setdefault(clave(d), 0)
        d += timedelta(days=1)
    por_b = {b.id: {"id": b.id, "nombre": b.nombre, "facturado": 0, "cortes": 0} for b in barberos}
    por_s: dict[UUID, int] = {}
    tot = cortes = aus = premios = 0
    for t in turnos:
        if t.estado == "no_asistio":
            aus += 1
            continue
        monto = t.cobrado if t.cobrado is not None else t.precio
        tot += monto
        cortes += 1
        premios += t.beneficio_aplicado
        por_b[t.barbero_id]["facturado"] += monto
        por_b[t.barbero_id]["cortes"] += 1
        por_s[t.servicio_id] = por_s.get(t.servicio_id, 0) + 1
        por_periodo[clave(t.inicio.astimezone(ZONA_AR).date())] += monto

    activos = {b.id for b in barberos if b.activo}
    return {
        "desde": desde,
        "hasta": hasta,
        "facturado": tot,
        "cortes": cortes,
        "ausencias": aus,
        "premios": premios,
        "por_barbero": [v for k, v in por_b.items() if k in activos or v["cortes"]],
        "servicios": sorted(
            ({"nombre": servicios[k], "veces": v} for k, v in por_s.items()),
            key=lambda x: -x["veces"],
        ),
        "agrupado": "mes" if por_mes else "dia",
        "por_periodo": [{"clave": k, "facturado": v} for k, v in por_periodo.items()],
    }
