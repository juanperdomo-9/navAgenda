"""logo de cada barbería (PNG cuadrado guardado en la base)

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("barberias", sa.Column("logo_png", sa.LargeBinary))


def downgrade() -> None:
    op.drop_column("barberias", "logo_png")
