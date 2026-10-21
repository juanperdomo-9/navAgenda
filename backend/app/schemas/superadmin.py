from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import SLUGS_RESERVADOS

SLUG = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class NuevaBarberia(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    slug: str = Field(min_length=2, max_length=60, pattern=SLUG)
    direccion: str | None = Field(default=None, max_length=160)
    barrio: str | None = Field(default=None, max_length=80)
    ciudad: str | None = Field(default="La Plata", max_length=80)
    # Admin dueño de la barbería
    admin_nombre: str = Field(min_length=2, max_length=80)
    admin_usuario: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9._-]+$")

    @field_validator("slug")
    @classmethod
    def slug_libre(cls, v: str) -> str:
        if v in SLUGS_RESERVADOS:
            raise ValueError(f"'{v}' es una ruta de NavAgenda; elegí otro link para la barbería.")
        return v


class BarberiaResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    slug: str
    barrio: str | None
    activa: bool


class AdminResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    usuario: str
    ultimo_ingreso: datetime | None
    debe_cambiar_clave: bool


class BarberiaConAdmins(BarberiaResumen):
    admins: list[AdminResumen]
    barberos: int


class EstadoBarberia(BaseModel):
    activa: bool


class BarberiaCreada(BaseModel):
    barberia: BarberiaResumen
    admin_usuario: str
    # Se muestra una sola vez: el superadmin se la pasa al dueño, que la cambia al entrar.
    clave_temporal: str


class ClaveReseteada(BaseModel):
    usuario: str
    clave_temporal: str
