"""Galería del local (hasta 8 fotos y 2 videos) y foto de cada barbero: se suben desde el panel."""

import uuid
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import DB, Admin
from app.models import Barbero, FotoLocal, VideoLocal
from app.services import almacen, imagenes

router = APIRouter(tags=["fotos"])
MAXIMO = 8
CACHE = {"Cache-Control": "public, max-age=604800, immutable"}


class Imagen(BaseModel):
    imagen: str = Field(min_length=100, max_length=8_000_000)


def url_foto(f: FotoLocal) -> str:
    return f"/api/foto/{f.id}.jpg"


@router.get("/panel/fotos")
def listar(admin: Admin, db: DB):
    fotos = db.scalars(
        select(FotoLocal)
        .where(FotoLocal.barberia_id == admin.barberia_id)
        .order_by(FotoLocal.orden, FotoLocal.creado_en)
    )
    return [{"id": f.id, "url": url_foto(f)} for f in fotos]


@router.post("/panel/fotos", status_code=status.HTTP_201_CREATED)
def subir(datos: Imagen, admin: Admin, db: DB):
    hay = db.scalar(select(func.count()).where(FotoLocal.barberia_id == admin.barberia_id))
    if hay >= MAXIMO:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Ya tenés {MAXIMO} fotos. Borrá una para subir otra."
        )
    f = FotoLocal(barberia_id=admin.barberia_id, orden=hay, jpg=imagenes.foto_jpg(datos.imagen))
    db.add(f)
    db.commit()
    return {"id": f.id, "url": url_foto(f)}


@router.delete("/panel/fotos/{foto_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar(foto_id: UUID, admin: Admin, db: DB) -> None:
    f = db.scalar(
        select(FotoLocal).where(FotoLocal.id == foto_id, FotoLocal.barberia_id == admin.barberia_id)
    )
    if not f:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa foto.")
    db.delete(f)
    db.commit()


@router.get("/foto/{foto_id}.jpg")
def ver(foto_id: UUID, db: DB):
    jpg = db.scalar(select(FotoLocal.jpg).where(FotoLocal.id == foto_id))
    if not jpg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe esa foto.")
    return Response(jpg, media_type="image/jpeg", headers=CACHE)


def _barbero(db, admin, barbero_id: UUID) -> Barbero:
    b = db.scalar(
        select(Barbero).where(Barbero.id == barbero_id, Barbero.barberia_id == admin.barberia_id)
    )
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese barbero.")
    return b


@router.put("/panel/barberos/{barbero_id}/foto")
def foto_barbero(barbero_id: UUID, datos: Imagen, admin: Admin, db: DB):
    b = _barbero(db, admin, barbero_id)
    b.foto_jpg = imagenes.cuadrada_jpg(datos.imagen)
    version = int((b.foto_url or "v=0").rsplit("v=", 1)[-1] or 0) + 1
    b.foto_url = f"/api/barbero/{b.id}.jpg?v={version}"
    db.commit()
    return {"foto_url": b.foto_url}


@router.delete("/panel/barberos/{barbero_id}/foto", status_code=status.HTTP_204_NO_CONTENT)
def quitar_foto_barbero(barbero_id: UUID, admin: Admin, db: DB) -> None:
    b = _barbero(db, admin, barbero_id)
    b.foto_jpg, b.foto_url = None, None
    db.commit()


@router.get("/barbero/{barbero_id}.jpg")
def ver_foto_barbero(barbero_id: UUID, db: DB):
    jpg = db.scalar(select(Barbero.foto_jpg).where(Barbero.id == barbero_id))
    if not jpg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese barbero no tiene foto.")
    return Response(jpg, media_type="image/jpeg", headers=CACHE)


# ─── Videos (Supabase Storage) ───

MAX_VIDEOS = 2
MAX_MB = 15
TIPOS = {"video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"}


class VideoNuevo(BaseModel):
    tipo: str = Field(max_length=40)
    bytes: int = Field(gt=0)


class VideoSubido(BaseModel):
    ruta: str = Field(max_length=200)


def _sin_almacen() -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Los videos todavía no están configurados. Avisale a NavAgenda.",
    )


def videos_de(db, barberia_id) -> list[dict]:
    if not almacen.configurado():
        return []
    vs = db.scalars(
        select(VideoLocal)
        .where(VideoLocal.barberia_id == barberia_id)
        .order_by(VideoLocal.creado_en)
    )
    return [{"id": v.id, "url": almacen.url_publica(v.ruta)} for v in vs]


@router.get("/panel/videos")
def listar_videos(admin: Admin, db: DB):
    return {"habilitado": almacen.configurado(), "videos": videos_de(db, admin.barberia_id)}


@router.post("/panel/videos/subida")
def pedir_subida(datos: VideoNuevo, admin: Admin, db: DB):
    """Valida y devuelve una URL firmada: el navegador sube el archivo directo a Supabase."""
    if not almacen.configurado():
        raise _sin_almacen()
    ext = TIPOS.get(datos.tipo.lower())
    if not ext:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Subí un video MP4, MOV o WEBM.")
    if datos.bytes > MAX_MB * 1024 * 1024:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"El video pesa más de {MAX_MB} MB. Cortalo o mandalo más corto (unos 20 segundos).",
        )
    hay = db.scalar(select(func.count()).where(VideoLocal.barberia_id == admin.barberia_id))
    if hay >= MAX_VIDEOS:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Ya tenés {MAX_VIDEOS} videos. Borrá uno para subir otro."
        )
    ruta = f"{admin.barberia_id}/{uuid.uuid4().hex}.{ext}"
    return {"ruta": ruta, "subir_url": almacen.firmar_subida(ruta)}


@router.post("/panel/videos", status_code=status.HTTP_201_CREATED)
def confirmar_video(datos: VideoSubido, admin: Admin, db: DB):
    """Después de subirlo: queda en la galería (solo rutas de su barbería y que existan)."""
    if not almacen.configurado():
        raise _sin_almacen()
    if not datos.ruta.startswith(f"{admin.barberia_id}/") or not almacen.existe(datos.ruta):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "No encontramos el video subido. Probá de nuevo."
        )
    v = VideoLocal(barberia_id=admin.barberia_id, ruta=datos.ruta)
    db.add(v)
    db.commit()
    return {"id": v.id, "url": almacen.url_publica(v.ruta)}


@router.delete("/panel/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_video(video_id: UUID, admin: Admin, db: DB) -> None:
    v = db.scalar(
        select(VideoLocal).where(
            VideoLocal.id == video_id, VideoLocal.barberia_id == admin.barberia_id
        )
    )
    if not v:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No existe ese video.")
    if almacen.configurado():
        almacen.borrar(v.ruta)
    db.delete(v)
    db.commit()
