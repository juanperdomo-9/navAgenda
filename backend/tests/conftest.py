"""Fixtures de base de datos para los tests.

Usan la base de test (TEST_DATABASE_URL, por defecto navagenda_test del docker-compose).
Al empezar la sesión se recrea el esquema con las migraciones de Alembic, y cada test corre
dentro de una transacción que se deshace al final: los tests no se ensucian entre sí.
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.config import get_settings

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    url = get_settings().test_database_url
    eng = create_engine(url)
    try:
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
    except OperationalError as e:  # pragma: no cover
        pytest.fail(
            "No hay conexión con la base de test "
            f"({eng.url.render_as_string(hide_password=True)}).\n"
            "Levantala con: docker compose up -d\n"
            f"Detalle: {e.orig}",
            pytrace=False,
        )

    with eng.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))

    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    cfg.cmd_opts = type("Opts", (), {"x": [f"url={url}"]})()
    command.upgrade(cfg, "head")

    yield eng
    eng.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    """Sesión dentro de una transacción que se deshace al terminar el test."""
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        conn.close()
