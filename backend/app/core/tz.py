"""Zona horaria: todo se guarda en UTC y se muestra en hora de Buenos Aires."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

ZONA_AR = ZoneInfo("America/Argentina/Buenos_Aires")


def ahora_utc() -> datetime:
    return datetime.now(UTC)


def a_utc(dt: datetime) -> datetime:
    """Convierte a UTC. Una fecha sin zona se interpreta como hora de Buenos Aires."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZONA_AR)
    return dt.astimezone(UTC)


def a_hora_ar(dt: datetime) -> datetime:
    """Convierte un instante (UTC u otra zona) a hora de Buenos Aires."""
    if dt.tzinfo is None:
        raise ValueError("Se esperaba una fecha con zona horaria (UTC)")
    return dt.astimezone(ZONA_AR)
