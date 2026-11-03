"""Panel del superadmin: alta de barberías con su admin y reseteo de claves de admins."""

import base64
import re
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB, Superadmin
from app.core.security import clave_temporal, hashear_clave
from app.models import Barberia, Barbero, ReglaBeneficio, Servicio, Usuario
from app.schemas.superadmin import (
    AltaCompleta,
    BarberiaConAdmins,
    BarberiaCreada,
    BarberiaResumen,
    ClaveReseteada,
    EstadoBarberia,
    NuevaBarberia,
    PdfSubido,
)
from app.services import importar_pdf
from app.services import panel as svc
from app.services.auth import buscar_por_usuario

router = APIRouter(prefix="/super", tags=["superadmin"])


@router.get("/barberias", response_model=list[BarberiaConAdmins])
def listar_barberias(_: Superadmin, db: DB):
    admins: dict = {}
    for u in db.scalars(select(Usuario).where(Usuario.rol == "admin").order_by(Usuario.nombre)):
        admins.setdefault(u.barberia_id, []).append(u)
    barberos = dict(
        db.execute(
            select(Barbero.barberia_id, func.count())
            .where(Barbero.activo)
            .group_by(Barbero.barberia_id)
        ).all()
    )
    return [
        BarberiaConAdmins(
            **BarberiaResumen.model_validate(b).model_dump(),
            admins=admins.get(b.id, []),
            barberos=barberos.get(b.id, 0),
        )
        for b in db.scalars(select(Barberia).order_by(Barberia.nombre))
    ]


@router.patch("/barberias/{barberia_id}", response_model=BarberiaResumen)
def cambiar_estado(barberia_id: UUID, datos: EstadoBarberia, _: Superadmin, db: DB):
    """Pausar una barbería (ej.: no pagó) la saca del portal y de su link; no borra nada."""
    b = db.get(Barberia, barberia_id)
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa barbería.")
    b.activa = datos.activa
    db.commit()
    return b


@router.post("/barberias", response_model=BarberiaCreada, status_code=status.HTTP_201_CREATED)
def crear_barberia(datos: NuevaBarberia, _: Superadmin, db: DB):
    barberia, clave = _alta(db, datos)
    return _confirmar(db, barberia, datos, clave)


def _alta(db, datos: NuevaBarberia) -> tuple[Barberia, str]:
    if db.scalar(select(Barberia.id).where(Barberia.slug == datos.slug)):
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Ya hay una barbería con el link /{datos.slug}."
        )
    if buscar_por_usuario(db, datos.admin_usuario):
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"El usuario '{datos.admin_usuario}' ya existe."
        )

    barberia = Barberia(
        nombre=datos.nombre,
        slug=datos.slug,
        direccion=datos.direccion,
        barrio=datos.barrio,
        ciudad=datos.ciudad,
        whatsapp=(datos.whatsapp or "").strip() or None,
        instagram=datos.instagram,
        descripcion=(datos.descripcion or "").strip() or None,
    )
    if datos.color_acento:
        barberia.color_acento = datos.color_acento
    barberia.logo_fondo = datos.logo_fondo
    if datos.horas_min_cancelacion is not None:
        barberia.horas_min_cancelacion = datos.horas_min_cancelacion
    db.add(barberia)
    db.flush()
    clave = clave_temporal()
    db.add(
        Usuario(
            barberia_id=barberia.id,
            nombre=datos.admin_nombre,
            usuario=datos.admin_usuario,
            password_hash=hashear_clave(clave),
            rol="admin",
            debe_cambiar_clave=True,
        )
    )
    return barberia, clave


def _confirmar(db, barberia: Barberia, datos: NuevaBarberia, clave: str) -> BarberiaCreada:
    try:
        db.commit()
    except IntegrityError:  # carrera con otra alta simultánea
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "El link o el usuario ya existen.") from None
    return BarberiaCreada(
        barberia=barberia, admin_usuario=datos.admin_usuario, clave_temporal=clave
    )


@router.post("/importar-pdf")
def importar_pdf_completado(datos: PdfSubido, _: Superadmin):
    """Lee el PDF 'Sumá tu barbería' completado y devuelve la propuesta de alta (no crea nada)."""
    try:
        crudo = base64.b64decode(datos.pdf.split(",")[-1])
        return importar_pdf.leer(crudo)
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from None
    except Exception:  # PDF roto o de otro tipo
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "No pudimos leer ese PDF. ¿Es el formulario 'Sumá tu barbería' completado?",
        ) from None


@router.post("/barberias/completa", response_model=BarberiaCreada, status_code=201)
def crear_barberia_completa(datos: AltaCompleta, _: Superadmin, db: DB):
    """Alta con todo: barbería, dueño, servicios, barberos (horarios y qué hacen) y tarjeta."""
    barberia, clave = _alta(db, datos)
    barberia.ruleta_bienvenida = datos.ruleta_bienvenida and bool(
        datos.tarjeta and datos.tarjeta.modo == "ruleta"
    )
    servicios: dict[str, Servicio] = {}
    for s in datos.servicios:
        if s.nombre.strip().lower() in servicios:
            continue
        servicios[s.nombre.strip().lower()] = svc.crear_servicio(
            db, barberia.id, s.nombre, s.precio, s.duracion_min
        )
    for x in datos.barberos:
        b = svc.crear_barbero(db, barberia.id, x.nombre, None, x.horarios)
        b.email = (x.email or "").strip().lower() or None
        ids = [
            servicios[n.strip().lower()].id for n in x.servicios if n.strip().lower() in servicios
        ]
        svc.asignar_servicios(db, b, ids or [s.id for s in servicios.values()])
    if datos.tarjeta:
        db.add(_regla(barberia.id, datos.tarjeta, servicios))
    return _confirmar(db, barberia, datos, clave)


def _regla(barberia_id, t, servicios: dict[str, Servicio]) -> ReglaBeneficio:
    """La tarjeta del PDF: ruleta con sus premios, o un premio fijo escrito a mano."""
    base = {"barberia_id": barberia_id, "cada_x_cortes": t.cada_x_cortes}
    if t.modo == "ruleta" and len(t.ruleta) >= 2:
        return ReglaBeneficio(
            **base,
            tipo="texto",
            modo="ruleta",
            ruleta=[p.model_dump() for p in t.ruleta],
            descripcion=f"Cada {t.cada_x_cortes} cortes, girás la ruleta",
        )
    premio = t.premio.strip() or "Premio"
    p = premio.lower()
    if m := re.search(r"(\d{1,3})\s*%", p):
        tipo, valor, sid = "descuento_pct", min(int(m[1]), 100), None
    elif m := re.search(r"\$\s*([\d.]+)", p):
        tipo, valor, sid = "descuento_monto", int(m[1].replace(".", "")), None
    elif "gratis" in p and (s := next((v for k, v in servicios.items() if k in p), None)):
        tipo, valor, sid = "servicio_gratis", None, s.id
    else:
        tipo, valor, sid = "texto", None, None
    return ReglaBeneficio(
        **base,
        tipo=tipo,
        valor=valor,
        servicio_id=sid,
        modo="fijo",
        ruleta=[],
        descripcion=f"Cada {t.cada_x_cortes} cortes: {premio}"[:120],
    )


@router.post("/usuarios/{usuario_id}/resetear-clave", response_model=ClaveReseteada)
def resetear_clave(usuario_id: UUID, _: Superadmin, db: DB):
    u = db.get(Usuario, usuario_id)
    if not u or u.rol != "admin":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese admin.")
    clave = clave_temporal()
    u.password_hash = hashear_clave(clave)
    u.debe_cambiar_clave = True
    u.intentos_fallidos = 0
    u.bloqueado_hasta = None
    db.commit()
    return ClaveReseteada(usuario=u.usuario, clave_temporal=clave)
