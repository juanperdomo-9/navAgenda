"""auth del panel: bloqueo por intentos, clave temporal y slugs reservados

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SLUGS_RESERVADOS = (
    "panel",
    "super",
    "t",
    "api",
    "buscar",
    "mapa",
    "mis-turnos",
    "ingresar",
    "dev",
    "assets",
    "static",
    "health",
)


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column(
            "debe_cambiar_clave", sa.Boolean, nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "usuarios", sa.Column("intentos_fallidos", sa.Integer, nullable=False, server_default="0")
    )
    op.add_column("usuarios", sa.Column("bloqueado_hasta", sa.DateTime(timezone=True)))
    op.add_column("usuarios", sa.Column("ultimo_ingreso", sa.DateTime(timezone=True)))
    reservados = ", ".join(repr(s) for s in SLUGS_RESERVADOS)
    op.create_check_constraint("slug_no_reservado", "barberias", f"slug NOT IN ({reservados})")


def downgrade() -> None:
    op.drop_constraint("slug_no_reservado", "barberias", type_="check")
    for col in ("ultimo_ingreso", "bloqueado_hasta", "intentos_fallidos", "debe_cambiar_clave"):
        op.drop_column("usuarios", col)
