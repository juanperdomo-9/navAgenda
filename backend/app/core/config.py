"""Configuración leída de variables de entorno (ver .env.example en la raíz)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    # Por defecto, el Postgres local de docker-compose. En Supabase se define en .env.
    database_url: str = "postgresql+psycopg://navagenda:navagenda@127.0.0.1:5433/navagenda"
    test_database_url: str = (
        "postgresql+psycopg://navagenda:navagenda@127.0.0.1:5433/navagenda_test"
    )
    jwt_secret: str = ""
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
