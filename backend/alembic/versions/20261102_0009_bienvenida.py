"""ruleta de bienvenida: un giro por teléfono nuevo, con 3 minutos para sacar turno

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "barberias",
        sa.Column("ruleta_bienvenida", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "bienvenidas",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("barberia_id", UUID(as_uuid=True), sa.ForeignKey("barberias.id"), nullable=False),
        sa.Column("telefono", sa.Text, nullable=False),
        sa.Column("premio", sa.Text, nullable=False),
        sa.Column("descuento_pct", sa.Integer, nullable=False),
        sa.Column("vence_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("turno_id", UUID(as_uuid=True), sa.ForeignKey("turnos.id", ondelete="SET NULL")),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("barberia_id", "telefono", name="bienvenida_una_por_telefono"),
        sa.CheckConstraint("descuento_pct BETWEEN 0 AND 100", name="bienvenida_descuento_valido"),
    )
    op.create_index("bienvenidas_turno", "bienvenidas", ["turno_id"])


def downgrade() -> None:
    op.drop_index("bienvenidas_turno", table_name="bienvenidas")
    op.drop_table("bienvenidas")
    op.drop_column("barberias", "ruleta_bienvenida")
