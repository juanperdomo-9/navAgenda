"""mail del cliente: confirmación con el ticket y recordatorio el día anterior (con su link)

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("clientes", sa.Column("email", sa.Text))
    op.add_column("turnos", sa.Column("recordado_en", sa.DateTime(timezone=True)))
    op.add_column("turnos", sa.Column("token_recordatorio_hash", sa.Text, unique=True))


def downgrade() -> None:
    op.drop_column("turnos", "token_recordatorio_hash")
    op.drop_column("turnos", "recordado_en")
    op.drop_column("clientes", "email")
