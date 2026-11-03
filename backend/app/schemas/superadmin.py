from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.color import acento_valido
from app.models import SLUGS_RESERVADOS
from app.schemas.panel import Tramo, usuario_instagram

SLUG = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class NuevaBarberia(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    slug: str = Field(min_length=2, max_length=60, pattern=SLUG)
    direccion: str | None = Field(default=None, max_length=160)
    barrio: str | None = Field(default=None, max_length=80)
    ciudad: str | None = Field(default="La Plata", max_length=80)
    # Todo lo de la sección 01 del formulario "Sumá tu barbería"
    whatsapp: str | None = Field(default=None, max_length=30)
    instagram: str | None = Field(default=None, max_length=80)
    color_acento: str | None = Field(default=None, max_length=7)
    descripcion: str | None = Field(default=None, max_length=600)
    horas_min_cancelacion: int | None = Field(default=None, ge=0, le=72)
    # Admin dueño de la barbería
    admin_nombre: str = Field(min_length=2, max_length=80)
    admin_usuario: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9._-]+$")

    @field_validator("instagram")
    @classmethod
    def insta(cls, v: str | None) -> str | None:
        return usuario_instagram(v)

    @field_validator("color_acento")
    @classmethod
    def color(cls, v: str | None) -> str | None:
        if not v:
            return None
        v = v.strip().lower()
        if not acento_valido(v if v.startswith("#") else "#" + v):
            raise ValueError("Ese color no deja leer bien el texto de la página. Probá otro.")
        return v if v.startswith("#") else "#" + v

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


# ─── Alta completa (la que arma el PDF "Sumá tu barbería") ───


class PdfSubido(BaseModel):
    pdf: str = Field(max_length=15_000_000)  # base64


class BarberoAlta(BaseModel):
    nombre: str = Field(min_length=2, max_length=60)
    email: str | None = Field(default=None, max_length=120)
    horarios: list[Tramo] = Field(default_factory=list, max_length=60)
    servicios: list[str] = Field(default_factory=list, max_length=50)  # por nombre


class ServicioAlta(BaseModel):
    nombre: str = Field(min_length=2, max_length=60)
    precio: int = Field(ge=0, le=10_000_000)
    duracion_min: int = Field(ge=5, le=480, multiple_of=5)


class PremioRuleta(BaseModel):
    texto: str = Field(min_length=2, max_length=60)
    descuento_pct: int = Field(ge=0, le=100)


class TarjetaAlta(BaseModel):
    cada_x_cortes: int = Field(ge=1, le=20)
    modo: str = Field(pattern=r"^(fijo|ruleta)$")
    ruleta: list[PremioRuleta] = Field(default_factory=list, max_length=12)
    premio: str = Field(default="", max_length=100)


class AltaCompleta(NuevaBarberia):
    barberos: list[BarberoAlta] = Field(default_factory=list, max_length=30)
    servicios: list[ServicioAlta] = Field(default_factory=list, max_length=50)
    tarjeta: TarjetaAlta | None = None
    ruleta_bienvenida: bool = False
