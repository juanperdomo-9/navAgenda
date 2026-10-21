"""Configuración leída de variables de entorno (ver .env.example en la raíz)."""

import secrets
import warnings
from functools import cached_property, lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    # "desarrollo" o "produccion". En producción la cookie de sesión exige HTTPS
    # y JWT_SECRET es obligatorio.
    entorno: str = "desarrollo"

    # Por defecto, el Postgres local de docker-compose. En Supabase se define en .env.
    database_url: str = "postgresql+psycopg://navagenda:navagenda@127.0.0.1:5433/navagenda"
    test_database_url: str = (
        "postgresql+psycopg://navagenda:navagenda@127.0.0.1:5433/navagenda_test"
    )
    jwt_secret: str = ""
    sesion_horas: int = 12
    cors_origins: str = "http://localhost:5173"

    @property
    def es_produccion(self) -> bool:
        return self.entorno == "produccion"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @cached_property
    def clave_jwt(self) -> str:
        """Clave para firmar sesiones. En desarrollo, sin JWT_SECRET, una al azar por proceso."""
        if self.jwt_secret:
            return self.jwt_secret
        if self.es_produccion:
            raise RuntimeError("Falta JWT_SECRET: es obligatorio en producción.")
        warnings.warn(
            "JWT_SECRET no está definido: se usa una clave temporal y las sesiones "
            "se pierden al reiniciar el servidor.",
            stacklevel=2,
        )
        return secrets.token_urlsafe(48)


@lru_cache
def get_settings() -> Settings:
    return Settings()
