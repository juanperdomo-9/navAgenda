"""Logo de cada barbería: se sube desde Mi página, se recorta en cuadrado y se sirve público."""

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DB, Admin
from app.models import Barberia
from app.services import imagenes

router = APIRouter(tags=["logo"])
LADO = 400


class LogoIn(BaseModel):
    # La imagen como data URL o base64 (hasta ~4 MB): así no hace falta multipart
    imagen: str = Field(min_length=100, max_length=6_000_000)


@router.put("/panel/barberia/logo")
def subir_logo(datos: LogoIn, admin: Admin, db: DB):
    b = db.get(Barberia, admin.barberia_id)
    b.logo_png = imagenes.cuadrada_png(datos.imagen)
    version = int((b.logo_url or "v=0").rsplit("v=", 1)[-1] or 0) + 1
    b.logo_url = f"/api/logo/{b.slug}.png?v={version}"
    db.commit()
    return {"logo_url": b.logo_url}


@router.delete("/panel/barberia/logo", status_code=status.HTTP_204_NO_CONTENT)
def quitar_logo(admin: Admin, db: DB) -> None:
    b = db.get(Barberia, admin.barberia_id)
    b.logo_png, b.logo_url = None, None
    db.commit()


@router.get("/logo/{slug}.png")
def ver_logo(slug: str, db: DB):
    png = db.scalar(select(Barberia.logo_png).where(Barberia.slug == slug, Barberia.activa))
    if not png:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esa barbería no tiene logo.")
    return Response(png, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
