"""Cobranza del abono mensual (superadmin): quién pagó, recordatorios de un toque y pausa por deuda.

Los recordatorios se mandan desde el WhatsApp del superadmin (wa.me con el mensaje armado):
el día 1 a todas; desde el día 2, cada 2 días, solo a las que deben. Si una barbería tiene
"pausa por deuda" y llega al día DIA_PAUSA sin pagar, se pausa sola; al marcar el pago se reactiva.
"""

from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import DB, Superadmin
from app.api.routers.publico import normalizar_telefono
from app.core.tz import ZONA_AR
from app.models import Barberia, Pago, Recordatorio, Usuario

router = APIRouter(prefix="/super", tags=["cobranza"])
DIA_PAUSA = 10
CADA_DIAS = 2


def _hoy() -> date:
    return datetime.now(ZONA_AR).date()


def _mes(texto: str | None) -> date:
    if not texto:
        return _hoy().replace(day=1)
    try:
        a, m = texto.split("-")
        return date(int(a), int(m), 1)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Mes inválido (AAAA-MM)."
        ) from None


def _barberia(db: Session, barberia_id: UUID) -> Barberia:
    b = db.get(Barberia, barberia_id)
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa barbería.")
    return b


def pausar_vencidas(db: Session, hoy: date | None = None) -> int:
    """Pausa las barberías con pausa por deuda que llegan al día DIA_PAUSA sin pagar el mes.

    Solo si ese mes ya se les mandó al menos un recordatorio: nadie queda pausado sin aviso.
    """
    hoy = hoy or _hoy()
    if hoy.day < DIA_PAUSA:
        return 0
    mes = hoy.replace(day=1)
    pagaron = select(Pago.barberia_id).where(Pago.mes == mes)
    avisadas = select(Recordatorio.barberia_id).where(Recordatorio.mes == mes)
    n = 0
    for b in db.scalars(
        select(Barberia).where(
            Barberia.activa,
            Barberia.pausa_por_deuda,
            Barberia.id.not_in(pagaron),
            Barberia.id.in_(avisadas),
        )
    ):
        b.activa, b.pausada_por_deuda = False, True
        n += 1
    if n:
        db.commit()
    return n


@router.get("/cobranza")
def cobranza(_: Superadmin, db: DB, mes: str | None = None):
    pausar_vencidas(db)
    m, hoy = _mes(mes), _hoy()
    actual = m == hoy.replace(day=1)
    pagos = {p.barberia_id: p for p in db.scalars(select(Pago).where(Pago.mes == m))}
    ultimos = dict(
        db.execute(
            select(Recordatorio.barberia_id, func.max(Recordatorio.enviado_en))
            .where(Recordatorio.mes == m)
            .group_by(Recordatorio.barberia_id)
        ).all()
    )
    duenos: dict = {}
    for u in db.scalars(select(Usuario).where(Usuario.rol == "admin").order_by(Usuario.nombre)):
        duenos.setdefault(u.barberia_id, u.nombre)
    items = []
    for b in db.scalars(select(Barberia).order_by(Barberia.nombre)):
        if not b.activa and not b.pausada_por_deuda:
            continue  # pausada a mano: no se le cobra
        pago, ultimo = pagos.get(b.id), ultimos.get(b.id)
        ult_dia = ultimo.astimezone(ZONA_AR).date() if ultimo else None
        toca = (
            actual
            and not pago
            and bool(b.whatsapp)
            and ult_dia != hoy
            and (hoy.day == 1 or ult_dia is None or (hoy - ult_dia).days >= CADA_DIAS)
        )
        items.append(
            {
                "id": b.id,
                "nombre": b.nombre,
                "dueno": duenos.get(b.id),
                "activa": b.activa,
                "whatsapp": b.whatsapp,
                "abono": b.abono,
                "pausa_por_deuda": b.pausa_por_deuda,
                "pausada_por_deuda": b.pausada_por_deuda,
                "pago": {"pagado_en": pago.pagado_en, "monto": pago.monto} if pago else None,
                "dias_debe": (hoy - m).days + 1 if actual and not pago else None,
                "ultimo_recordatorio": ultimo,
                "toca_recordar": toca,
            }
        )
    return {"mes": m.isoformat()[:7], "hoy": hoy, "dia_pausa": DIA_PAUSA, "barberias": items}


class Cobro(BaseModel):
    whatsapp: str | None = Field(default=None, max_length=24)
    abono: int | None = Field(default=None, ge=0, le=10_000_000)
    pausa_por_deuda: bool | None = None


@router.patch("/barberias/{barberia_id}/cobro")
def datos_de_cobro(barberia_id: UUID, datos: Cobro, _: Superadmin, db: DB):
    b = _barberia(db, barberia_id)
    cambios = datos.model_dump(exclude_unset=True)
    if "whatsapp" in cambios:
        tel = normalizar_telefono(cambios["whatsapp"]) if cambios["whatsapp"] else None
        if cambios["whatsapp"] and not tel:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Revisá el WhatsApp: con código de área, sin 0 ni 15.",
            )
        b.whatsapp = tel
    if "abono" in cambios:
        b.abono = cambios["abono"]
    if cambios.get("pausa_por_deuda") is not None:
        b.pausa_por_deuda = cambios["pausa_por_deuda"]
    db.commit()
    return {"whatsapp": b.whatsapp, "abono": b.abono, "pausa_por_deuda": b.pausa_por_deuda}


class Mes(BaseModel):
    mes: str | None = None


@router.post("/cobranza/{barberia_id}/pago", status_code=status.HTTP_201_CREATED)
def marcar_pago(barberia_id: UUID, datos: Mes, _: Superadmin, db: DB):
    b, m = _barberia(db, barberia_id), _mes(datos.mes)
    if not db.scalar(select(Pago).where(Pago.barberia_id == b.id, Pago.mes == m)):
        db.add(Pago(barberia_id=b.id, mes=m, monto=b.abono))
    if b.pausada_por_deuda:  # pagó: vuelve a estar online
        b.activa, b.pausada_por_deuda = True, False
    db.commit()
    return {"ok": True, "activa": b.activa}


@router.delete("/cobranza/{barberia_id}/pago", status_code=status.HTTP_204_NO_CONTENT)
def deshacer_pago(barberia_id: UUID, _: Superadmin, db: DB, mes: str | None = None) -> None:
    p = db.scalar(select(Pago).where(Pago.barberia_id == barberia_id, Pago.mes == _mes(mes)))
    if p:
        db.delete(p)
        db.commit()


@router.post("/cobranza/{barberia_id}/recordatorio", status_code=status.HTTP_201_CREATED)
def anotar_recordatorio(barberia_id: UUID, datos: Mes, _: Superadmin, db: DB):
    b = _barberia(db, barberia_id)
    db.add(Recordatorio(barberia_id=b.id, mes=_mes(datos.mes)))
    db.commit()
    return {"ok": True}
