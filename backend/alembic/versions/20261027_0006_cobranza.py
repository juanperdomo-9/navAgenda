"""cobranza del abono: datos de cobro, pagos por mes y recordatorios

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _id():
    return sa.Column(
        "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )


def _barberia():
    return sa.Column(
        "barberia_id", UUID(as_uuid=True), sa.ForeignKey("barberias.id"), nullable=False
    )


def upgrade() -> None:
    op.add_column("barberias", sa.Column("whatsapp", sa.Text))
    op.add_column("barberias", sa.Column("abono", sa.Integer))
    for col in ("pausa_por_deuda", "pausada_por_deuda"):
        op.add_column(
            "barberias", sa.Column(col, sa.Boolean, nullable=False, server_default=sa.text("false"))
        )
    op.create_table(
        "pagos",
        _id(),
        _barberia(),
        sa.Column("mes", sa.Date, nullable=False),
        sa.Column("monto", sa.Integer),
        sa.Column(
            "pagado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("barberia_id", "mes", name="un_pago_por_mes"),
    )
    op.create_table(
        "recordatorios",
        _id(),
        _barberia(),
        sa.Column("mes", sa.Date, nullable=False),
        sa.Column(
            "enviado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("recordatorios")
    op.drop_table("pagos")
    for col in ("pausada_por_deuda", "pausa_por_deuda", "abono", "whatsapp"):
        op.drop_column("barberias", col)
