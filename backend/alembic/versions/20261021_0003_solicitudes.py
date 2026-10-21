"""solicitudes para sumar una barbería y slug reservado 'sumar'

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ANTES = (
    "panel", "super", "t", "api", "buscar", "mapa", "mis-turnos",
    "ingresar", "dev", "assets", "static", "health",
)  # fmt: skip


def _slugs(lista) -> str:
    return "slug NOT IN (" + ", ".join(repr(s) for s in lista) + ")"


def upgrade() -> None:
    op.create_table(
        "solicitudes",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("barberia", sa.Text, nullable=False),
        sa.Column("nombre", sa.Text, nullable=False),
        sa.Column("telefono", sa.Text, nullable=False),
        sa.Column("barrio", sa.Text),
        sa.Column("mensaje", sa.Text),
        sa.Column("estado", sa.Text, nullable=False, server_default="pendiente"),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("estado IN ('pendiente', 'creada', 'descartada')", name="estado_valido"),
    )
    op.drop_constraint("slug_no_reservado", "barberias", type_="check")
    op.create_check_constraint("slug_no_reservado", "barberias", _slugs((*ANTES, "sumar")))


def downgrade() -> None:
    op.drop_constraint("slug_no_reservado", "barberias", type_="check")
    op.create_check_constraint("slug_no_reservado", "barberias", _slugs(ANTES))
    op.drop_table("solicitudes")
