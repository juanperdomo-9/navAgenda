from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

CLAVE_MIN = 10


class Ingreso(BaseModel):
    usuario: str = Field(min_length=1, max_length=64)
    clave: str = Field(min_length=1, max_length=256)


class CambioClave(BaseModel):
    clave_actual: str = Field(min_length=1, max_length=256)
    clave_nueva: str = Field(min_length=CLAVE_MIN, max_length=256)


class UsuarioPanel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    usuario: str
    rol: str
    barberia_id: UUID | None
    debe_cambiar_clave: bool
    ultimo_ingreso: datetime | None
