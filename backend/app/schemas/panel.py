"""Esquemas del panel del admin de barbería."""

from datetime import time
from decimal import Decimal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.color import acento_valido

DIAS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")


class Tramo(BaseModel):
    """Tramo de trabajo semanal. dia_semana: 0 = lunes … 6 = domingo."""

    model_config = ConfigDict(from_attributes=True)

    dia_semana: int = Field(ge=0, le=6)
    desde: time
    hasta: time

    @model_validator(mode="after")
    def rango(self) -> "Tramo":
        for t in (self.desde, self.hasta):
            if t.minute % 5 or t.second or t.microsecond:
                raise ValueError("Los horarios van en múltiplos de 5 minutos (ej. 10:00, 10:05).")
        if self.desde >= self.hasta:
            raise ValueError(
                f"El {DIAS[self.dia_semana]}, el horario tiene que terminar después de empezar."
            )
        return self


def _sin_superposicion(tramos: list[Tramo]) -> list[Tramo]:
    por_dia: dict[int, list[Tramo]] = {}
    for t in tramos:
        por_dia.setdefault(t.dia_semana, []).append(t)
    for dia, lista in por_dia.items():
        lista.sort(key=lambda t: t.desde)
        for a, b in zip(lista, lista[1:], strict=False):
            if b.desde < a.hasta:
                raise ValueError(f"El {DIAS[dia]} hay dos horarios que se pisan.")
    return sorted(tramos, key=lambda t: (t.dia_semana, t.desde))


# ─── Barberos ───


MAIL = r"^\s*$|^\s*[^@\s]+@[^@\s]+\.[^@\s]+\s*$"


class BarberoNuevo(BaseModel):
    nombre: str = Field(min_length=2, max_length=60)
    foto_url: str | None = Field(default=None, max_length=500)
    email: str | None = Field(default=None, max_length=120, pattern=MAIL)
    horarios: list[Tramo] = Field(default_factory=list, max_length=60)

    @field_validator("horarios")
    @classmethod
    def sin_superposicion(cls, v: list[Tramo]) -> list[Tramo]:
        return _sin_superposicion(v)


class BarberoCambios(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=60)
    foto_url: str | None = Field(default=None, max_length=500)
    email: str | None = Field(default=None, max_length=120, pattern=MAIL)
    activo: bool | None = None


class Horarios(BaseModel):
    horarios: list[Tramo] = Field(max_length=60)

    @field_validator("horarios")
    @classmethod
    def sin_superposicion(cls, v: list[Tramo]) -> list[Tramo]:
        return _sin_superposicion(v)


class ServiciosDelBarbero(BaseModel):
    servicio_ids: list[UUID] = Field(max_length=100)


class BarberosDelServicio(BaseModel):
    barbero_ids: list[UUID] = Field(max_length=100)


class BarberoOut(BaseModel):
    id: UUID
    nombre: str
    foto_url: str | None
    email: str | None = None
    activo: bool
    horarios: list[Tramo]
    servicio_ids: list[UUID]


# ─── Días libres (bloqueos) ───


class BloqueoNuevo(BaseModel):
    inicio: AwareDatetime
    fin: AwareDatetime
    motivo: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def rango(self) -> "BloqueoNuevo":
        if self.fin <= self.inicio:
            raise ValueError("El bloqueo tiene que terminar después de empezar.")
        return self


class BloqueoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    barbero_id: UUID
    inicio: AwareDatetime
    fin: AwareDatetime
    motivo: str | None


# ─── Servicios ───


class ServicioNuevo(BaseModel):
    nombre: str = Field(min_length=2, max_length=60)
    precio: int = Field(ge=0, le=10_000_000)
    duracion_min: int = Field(ge=5, le=480, multiple_of=5)


class ServicioCambios(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=60)
    precio: int | None = Field(default=None, ge=0, le=10_000_000)
    duracion_min: int | None = Field(default=None, ge=5, le=480, multiple_of=5)
    activo: bool | None = None


class ServicioOut(BaseModel):
    id: UUID
    nombre: str
    precio: int
    duracion_min: int
    activo: bool
    barbero_ids: list[UUID]


# ─── Configuración de la página ───


class ConfigBarberia(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    slug: str
    logo_url: str | None
    color_acento: str
    direccion: str | None
    ciudad: str | None
    barrio: str | None
    lat: Decimal | None
    lng: Decimal | None
    descripcion: str | None
    horas_min_cancelacion: int


class ConfigCambios(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=80)
    logo_url: str | None = Field(default=None, max_length=500)
    color_acento: str | None = None
    direccion: str | None = Field(default=None, max_length=160)
    ciudad: str | None = Field(default=None, max_length=80)
    barrio: str | None = Field(default=None, max_length=80)
    lat: Decimal | None = Field(default=None, ge=-90, le=90)
    lng: Decimal | None = Field(default=None, ge=-180, le=180)
    descripcion: str | None = Field(default=None, max_length=600)
    horas_min_cancelacion: int | None = Field(default=None, ge=0, le=72)

    @field_validator("color_acento")
    @classmethod
    def color(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not v.startswith("#"):
            v = "#" + v
        if not acento_valido(v):
            raise ValueError(
                "Ese color no deja leer bien el texto de la página. "
                "Probá uno más claro o más oscuro."
            )
        return v

    @model_validator(mode="after")
    def ubicacion(self) -> "ConfigCambios":
        if (self.lat is None) != (self.lng is None) and (
            "lat" in self.model_fields_set or "lng" in self.model_fields_set
        ):
            raise ValueError("La ubicación necesita latitud y longitud juntas.")
        return self
