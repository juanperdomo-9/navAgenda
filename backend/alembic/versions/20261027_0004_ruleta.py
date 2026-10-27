"""ruleta de premios: modo de la regla, giros y lo cobrado en cada turno

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reglas_beneficio", sa.Column("modo", sa.Text, nullable=False, server_default="fijo")
    )
    op.add_column(
        "reglas_beneficio",
        sa.Column("ruleta", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.create_check_constraint("modo_valido", "reglas_beneficio", "modo IN ('fijo', 'ruleta')")
    op.add_column("turnos", sa.Column("cobrado", sa.Integer))
    op.create_table(
        "giros",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "barberia_id",
            UUID(as_uuid=True),
            sa.ForeignKey("barberias.id"),
            nullable=False,
        ),
        sa.Column("cliente_id", UUID(as_uuid=True), nullable=False),
        sa.Column("premio", sa.Text, nullable=False),
        sa.Column("descuento_pct", sa.Integer, nullable=False),
        sa.Column("turno_id", UUID(as_uuid=True), sa.ForeignKey("turnos.id")),
        sa.Column("usado_en", sa.DateTime(timezone=True)),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["cliente_id", "barberia_id"],
            ["clientes.id", "clientes.barberia_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("descuento_pct BETWEEN 0 AND 100", name="descuento_valido"),
    )
    op.create_index("giros_cliente", "giros", ["cliente_id"])


def downgrade() -> None:
    op.drop_index("giros_cliente", table_name="giros")
    op.drop_table("giros")
    op.drop_column("turnos", "cobrado")
    op.drop_constraint("modo_valido", "reglas_beneficio", type_="check")
    op.drop_column("reglas_beneficio", "ruleta")
    op.drop_column("reglas_beneficio", "modo")
