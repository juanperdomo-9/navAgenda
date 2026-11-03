"""API pública: página de la barbería, horarios libres, reservar sin cuenta y el ticket."""

import hashlib
import re
import secrets
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB
from app.core.security import LimitePorIP
from app.core.tz import ZONA_AR
from app.models import (
    Barberia,
    Barbero,
    BarberoServicio,
    Bienvenida,
    Cliente,
    Fidelidad,
    FotoLocal,
    HorarioBarbero,
    ReglaBeneficio,
    Servicio,
    Turno,
)
from app.services import avisos, bienvenida, premios
from app.services.disponibilidad import horarios_libres

router = APIRouter(tags=["público"])
limite_reservas = LimitePorIP(maximo=10, segundos=60 * 60)
limite_bienvenida = LimitePorIP(maximo=10, segundos=60 * 60)
MAX_TURNOS_FUTUROS = 2


def normalizar_telefono(v: str) -> str | None:
    """'221 456-7890', '0221 15 456 7890' o '+54 9 221…' → '+5492214567890'."""
    d = re.sub(r"\D", "", v)
    if d.startswith("54"):
        d = d[2:]
    if d.startswith("9") and len(d) == 11:
        d = d[1:]
    if d.startswith("0"):
        d = d[1:]
    if len(d) == 12:  # característica + 15 + número: 11 15…, 221 15…, 2221 15…
        k = (
            2
            if d.startswith("11") and d[2:4] == "15"
            else 3
            if d[3:5] == "15"
            else 4
            if d[4:6] == "15"
            else 0
        )
        if k:
            d = d[:k] + d[k + 2 :]
    return "+549" + d if len(d) == 10 else None


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _barberia(db, slug: str) -> Barberia:
    b = db.scalar(select(Barberia).where(Barberia.slug == slug, Barberia.activa))
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa barbería.")
    return b


# ─── Portal: todas las barberías con su próximo turno libre ───


@router.get("/p")
def portal(db: DB):
    hoy = datetime.now(ZONA_AR).date()
    salida = []
    for b in db.scalars(select(Barberia).where(Barberia.activa).order_by(Barberia.nombre)):
        servicios = db.scalars(
            select(Servicio)
            .where(Servicio.barberia_id == b.id, Servicio.activo)
            .order_by(Servicio.precio)
        ).all()
        if not servicios:
            continue
        prox = None
        for d in range(7):  # el primer horario libre de la semana, con el servicio más barato
            libres = horarios_libres(db, b.id, servicios[0].id, hoy + timedelta(days=d))
            if libres:
                prox = libres[0].inicio
                break
        salida.append(
            {
                "nombre": b.nombre,
                "slug": b.slug,
                "color_acento": b.color_acento,
                "logo_url": b.logo_url,
                "direccion": b.direccion,
                "barrio": b.barrio,
                "lat": b.lat,
                "lng": b.lng,
                "precio_desde": servicios[0].precio,
                "proximo_libre": prox,
            }
        )
    salida.sort(
        key=lambda x: (
            x["proximo_libre"] is None,
            x["proximo_libre"] or datetime.max.replace(tzinfo=UTC),
        )
    )
    return salida


# ─── Página de la barbería ───


@router.get("/p/{slug}")
def pagina(slug: str, db: DB):
    b = _barberia(db, slug)
    barberos = db.scalars(
        select(Barbero).where(Barbero.barberia_id == b.id, Barbero.activo).order_by(Barbero.nombre)
    ).all()
    servicios = db.scalars(
        select(Servicio)
        .where(Servicio.barberia_id == b.id, Servicio.activo)
        .order_by(Servicio.precio)
    ).all()
    hace = db.execute(
        select(BarberoServicio.barbero_id, BarberoServicio.servicio_id).where(
            BarberoServicio.barberia_id == b.id
        )
    ).all()
    regla = db.scalar(
        select(ReglaBeneficio).where(ReglaBeneficio.barberia_id == b.id, ReglaBeneficio.activa)
    )
    horarios = db.scalars(
        select(HorarioBarbero)
        .where(HorarioBarbero.barbero_id.in_([x.id for x in barberos]))
        .order_by(HorarioBarbero.dia_semana, HorarioBarbero.desde)
    ).all()
    fotos = db.scalars(
        select(FotoLocal.id)
        .where(FotoLocal.barberia_id == b.id)
        .order_by(FotoLocal.orden, FotoLocal.creado_en)
    ).all()
    return {
        "fotos": [f"/api/foto/{f}.jpg" for f in fotos],
        "nombre": b.nombre,
        "slug": b.slug,
        "color_acento": b.color_acento,
        "logo_url": b.logo_url,
        "direccion": b.direccion,
        "barrio": b.barrio,
        "ciudad": b.ciudad,
        "lat": b.lat,
        "lng": b.lng,
        "descripcion": b.descripcion,
        "instagram": b.instagram,
        "horas_min_cancelacion": b.horas_min_cancelacion,
        "bienvenida": bienvenida.activa(db, b),
        "barberos": [
            {
                "id": x.id,
                "nombre": x.nombre,
                "foto_url": x.foto_url,
                "servicio_ids": [s for bb, s in hace if bb == x.id],
                "horarios": [
                    {"dia_semana": h.dia_semana, "desde": h.desde, "hasta": h.hasta}
                    for h in horarios
                    if h.barbero_id == x.id
                ],
            }
            for x in barberos
        ],
        "servicios": [
            {"id": s.id, "nombre": s.nombre, "precio": s.precio, "duracion_min": s.duracion_min}
            for s in servicios
        ],
        "fidelidad": {
            "cada": regla.cada_x_cortes,
            "descripcion": regla.descripcion,
            "modo": "ruleta" if premios.es_ruleta(regla) else "fijo",
            "ruleta": [p["texto"] for p in regla.ruleta] if premios.es_ruleta(regla) else [],
        }
        if regla
        else None,
    }


@router.get("/p/{slug}/libres")
def libres(slug: str, servicio_id: UUID, fecha: date, db: DB, barbero_id: UUID | None = None):
    if fecha > date.today() + timedelta(days=60):
        return []
    b = _barberia(db, slug)
    return [
        {"inicio": x.inicio, "fin": x.fin, "barbero_id": x.barbero_id}
        for x in horarios_libres(db, b.id, servicio_id, fecha, barbero_id)
    ]


# ─── Reservar ───


class Reserva(BaseModel):
    servicio_id: UUID
    barbero_id: UUID | None = None  # None = cualquiera (el primero libre a esa hora)
    inicio: AwareDatetime
    nombre: str = Field(min_length=2, max_length=60)
    telefono: str = Field(min_length=8, max_length=24)
    # Para la confirmación con el ticket y el recordatorio del día anterior
    email: str = Field(max_length=120, pattern=r"^\s*[^@\s]+@[^@\s]+\.[^@\s]+\s*$")


def _por_que_no(db, barberia_id, datos: Reserva, dia: date, inicio: datetime) -> str:
    """Los horarios se ofrecen con el servicio más corto: si con ese sí entra, el problema es
    que el servicio elegido es más largo (termina después del cierre o pisa el próximo turno)."""
    s = db.scalar(
        select(Servicio).where(
            Servicio.id == datos.servicio_id, Servicio.barberia_id == barberia_id
        )
    )
    corto = db.scalar(
        select(Servicio)
        .where(Servicio.barberia_id == barberia_id, Servicio.activo)
        .order_by(Servicio.duracion_min)
        .limit(1)
    )
    if s and corto and corto.duracion_min < s.duracion_min:
        libres_corto = horarios_libres(db, barberia_id, corto.id, dia, datos.barbero_id)
        if any(x.inicio == inicio for x in libres_corto):
            return (
                f"{s.nombre} dura {s.duracion_min} min y no entra a esa hora. "
                "Elegí un horario más temprano u otro servicio."
            )
    return "Ese horario ya no está libre. Elegí otro."


@router.post("/p/{slug}/turnos", status_code=status.HTTP_201_CREATED)
def reservar(slug: str, datos: Reserva, request: Request, db: DB, tareas: BackgroundTasks):
    ip = request.client.host if request.client else "?"
    if not limite_reservas.permitir(ip):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Demasiadas reservas seguidas. Probá en un rato."
        )
    tel = normalizar_telefono(datos.telefono)
    if not tel:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Revisá el teléfono: con código de área, sin 0 ni 15. Ej.: 221 456 7890.",
        )
    b = _barberia(db, slug)
    inicio = datos.inicio.astimezone(UTC)
    dia = inicio.astimezone(ZONA_AR).date()
    candidatos = [
        x
        for x in horarios_libres(db, b.id, datos.servicio_id, dia, datos.barbero_id)
        if x.inicio == inicio
    ]
    if not candidatos:
        raise HTTPException(status.HTTP_409_CONFLICT, _por_que_no(db, b.id, datos, dia, inicio))

    cliente = db.scalar(select(Cliente).where(Cliente.barberia_id == b.id, Cliente.telefono == tel))
    if cliente and cliente.bloqueado:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "No podés sacar turno online. Comunicate con la barbería."
        )
    if cliente:
        futuros = db.scalar(
            select(func.count())
            .select_from(Turno)
            .where(
                Turno.cliente_id == cliente.id,
                Turno.estado == "reservado",
                Turno.inicio > datetime.now(UTC),
            )
        )
        if futuros >= MAX_TURNOS_FUTUROS:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Ya tenés {futuros} turnos sacados acá. Cancelá uno para sacar otro.",
            )
        cliente.nombre = datos.nombre.strip()
    else:
        cliente = Cliente(barberia_id=b.id, telefono=tel, nombre=datos.nombre.strip())
        db.add(cliente)
        db.flush()
    cliente.email = datos.email.strip().lower()

    servicio = db.get(Servicio, datos.servicio_id)
    token = secrets.token_urlsafe(18)
    turno = Turno(
        barberia_id=b.id,
        barbero_id=candidatos[0].barbero_id,
        cliente_id=cliente.id,
        servicio_id=servicio.id,
        inicio=inicio,
        fin=candidatos[0].fin,
        precio=servicio.precio,
        token_acceso_hash=_hash(token),
        origen="web",
    )
    db.add(turno)
    try:
        db.flush()
        bienvenida.vincular(db, b.id, tel, turno)
        db.commit()
    except IntegrityError:  # otro lo sacó en el mismo instante (la base no deja superponer)
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ese horario se acaba de ocupar. Elegí otro."
        ) from None
    tareas.add_task(avisos.mandar, avisos.armar(db, turno, "nuevo"))
    tareas.add_task(avisos.mandar, avisos.confirmacion(db, turno, token))
    return {"token": token, **_ticket(db, turno)}


class TelefonoNuevo(BaseModel):
    telefono: str = Field(min_length=8, max_length=24)


@router.post("/p/{slug}/bienvenida")
def ruleta_de_bienvenida(slug: str, datos: TelefonoNuevo, request: Request, db: DB):
    """Si el teléfono es nuevo en la barbería, gira la ruleta (una sola vez, para siempre)."""
    ip = request.client.host if request.client else "?"
    if not limite_bienvenida.permitir(ip):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos seguidos. Probá en un rato."
        )
    b = _barberia(db, slug)
    if not bienvenida.activa(db, b):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Esta barbería no tiene ruleta de bienvenida."
        )
    tel = normalizar_telefono(datos.telefono)
    if not tel:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Revisá el teléfono: con código de área, sin 0 ni 15. Ej.: 221 456 7890.",
        )
    ya = db.scalar(
        select(Bienvenida).where(Bienvenida.barberia_id == b.id, Bienvenida.telefono == tel)
    )
    if ya:
        return {"nuevo": False, "motivo": "Ese número ya giró la ruleta de bienvenida."}
    if not bienvenida.es_nuevo(db, b.id, tel):
        return {"nuevo": False, "motivo": "La ruleta es para la primera vez. ¡Gracias por volver!"}
    try:
        g, i = bienvenida.girar(db, b, tel)
        db.commit()
    except IntegrityError:  # dos toques al mismo tiempo: vale el primero
        db.rollback()
        return {"nuevo": False, "motivo": "Ese número ya giró la ruleta de bienvenida."}
    return {
        "nuevo": True,
        "indice": i,
        "premio": g.premio,
        "vence_en": g.vence_en,
        "dias": bienvenida.DIAS_PARA_EL_TURNO,
    }


# ─── El ticket: link privado del turno ───


def _ticket(db, t: Turno) -> dict:
    b, s, x, c = (
        db.get(Barberia, t.barberia_id),
        db.get(Servicio, t.servicio_id),
        db.get(Barbero, t.barbero_id),
        db.get(Cliente, t.cliente_id),
    )
    regla = db.scalar(
        select(ReglaBeneficio).where(ReglaBeneficio.barberia_id == b.id, ReglaBeneficio.activa)
    )
    fid = db.get(Fidelidad, c.id)
    limite = t.inicio - timedelta(hours=b.horas_min_cancelacion)
    return {
        "estado": t.estado,
        "inicio": t.inicio,
        "fin": t.fin,
        "precio": t.precio,
        "servicio": s.nombre,
        "barbero": x.nombre,
        "cliente": c.nombre,
        "barberia": {
            "nombre": b.nombre,
            "slug": b.slug,
            "color_acento": b.color_acento,
            "direccion": b.direccion,
            "barrio": b.barrio,
            "ciudad": b.ciudad,
        },
        "bienvenida": g.premio if (g := bienvenida.del_turno(db, t)) else None,
        "se_puede_cancelar": t.estado == "reservado" and datetime.now(UTC) < limite,
        "cancelar_hasta": limite,
        "fidelidad": {
            "cada": regla.cada_x_cortes,
            "descripcion": regla.descripcion,
            "cortes": fid.cortes_acumulados if fid else 0,
            "premios": fid.beneficios_disponibles if fid else 0,
            "modo": "ruleta" if premios.es_ruleta(regla) else "fijo",
            "ruleta": [p["texto"] for p in regla.ruleta] if premios.es_ruleta(regla) else [],
            "puede_girar": premios.puede_girar(db, regla, fid),
            "premio": premios.premio_pendiente(db, regla, fid),
        }
        if regla
        else None,
    }


def _por_token(db, token: str) -> Turno:
    # Vale el link de la reserva o el del recordatorio
    h = _hash(token)
    t = db.scalar(
        select(Turno).where(or_(Turno.token_acceso_hash == h, Turno.token_recordatorio_hash == h))
    )
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos ese turno. Revisá el link.")
    return t


@router.get("/t/{token}")
def ver_ticket(token: str, db: DB):
    return _ticket(db, _por_token(db, token))


@router.post("/t/{token}/girar")
def girar_ruleta(token: str, db: DB):
    """El cliente gira la ruleta (una vez por premio ganado). El azar lo decide el servidor."""
    t = _por_token(db, token)
    regla = db.scalar(
        select(ReglaBeneficio).where(
            ReglaBeneficio.barberia_id == t.barberia_id, ReglaBeneficio.activa
        )
    )
    # Bloquea la tarjeta: dos toques seguidos no pueden girar dos veces el mismo premio
    fid = db.get(Fidelidad, t.cliente_id, with_for_update=True)
    if not premios.puede_girar(db, regla, fid):
        raise HTTPException(status.HTTP_409_CONFLICT, "No tenés una ruleta para girar.")
    g, i = premios.girar(db, regla, fid)
    db.commit()
    return {"indice": i, "premio": g.premio, "ticket": _ticket(db, t)}


@router.post("/t/{token}/cancelar")
def cancelar(token: str, db: DB, tareas: BackgroundTasks):
    t = _por_token(db, token)
    info = _ticket(db, t)
    if not info["se_puede_cancelar"]:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Este turno ya no se puede cancelar desde acá. Avisale a la barbería."
            if t.estado == "reservado"
            else "Este turno ya no está activo.",
        )
    t.estado = "cancelado"
    db.commit()
    tareas.add_task(avisos.mandar, avisos.armar(db, t, "cancelado"))
    return _ticket(db, t)
