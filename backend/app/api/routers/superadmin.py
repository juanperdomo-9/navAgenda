"""Panel del superadmin: alta de barberías con su admin y reseteo de claves de admins."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import DB, Superadmin
from app.core.security import clave_temporal, hashear_clave
from app.models import Barberia, Usuario
from app.schemas.superadmin import BarberiaCreada, BarberiaResumen, ClaveReseteada, NuevaBarberia
from app.services.auth import buscar_por_usuario

router = APIRouter(prefix="/super", tags=["superadmin"])


@router.get("/barberias", response_model=list[BarberiaResumen])
def listar_barberias(_: Superadmin, db: DB):
    return db.scalars(select(Barberia).order_by(Barberia.nombre)).all()


@router.post("/barberias", response_model=BarberiaCreada, status_code=status.HTTP_201_CREATED)
def crear_barberia(datos: NuevaBarberia, _: Superadmin, db: DB):
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
    )
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
    try:
        db.commit()
    except IntegrityError:  # carrera con otra alta simultánea
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "El link o el usuario ya existen.") from None
    return BarberiaCreada(
        barberia=barberia, admin_usuario=datos.admin_usuario, clave_temporal=clave
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
