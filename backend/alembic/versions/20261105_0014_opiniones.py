"""opiniones de clientes que fueron (estrellas, texto, video opcional) y pedido por mail

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "opiniones",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("barberia_id", UUID(as_uuid=True), sa.ForeignKey("barberias.id"), nullable=False),
        sa.Column(
            "turno_id",
            UUID(as_uuid=True),
            sa.ForeignKey("turnos.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("estrellas", sa.Integer, nullable=False),
        sa.Column("texto", sa.Text),
        sa.Column("video_ruta", sa.Text),
        sa.Column("visible", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("estrellas BETWEEN 1 AND 5", name="estrellas_validas"),
    )
    op.create_index("opiniones_barberia", "opiniones", ["barberia_id", "creado_en"])
    op.add_column("turnos", sa.Column("opinion_pedida_en", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("turnos", "opinion_pedida_en")
    op.drop_index("opiniones_barberia", table_name="opiniones")
    op.drop_table("opiniones")
