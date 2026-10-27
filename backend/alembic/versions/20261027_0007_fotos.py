"""fotos: galería del local y foto de cada barbero

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("barberos", sa.Column("foto_jpg", sa.LargeBinary))
    op.create_table(
        "fotos_local",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("barberia_id", UUID(as_uuid=True), sa.ForeignKey("barberias.id"), nullable=False),
        sa.Column("orden", sa.Integer, nullable=False, server_default="0"),
        sa.Column("jpg", sa.LargeBinary, nullable=False),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("fotos_local_barberia", "fotos_local", ["barberia_id", "orden"])


def downgrade() -> None:
    op.drop_index("fotos_local_barberia", table_name="fotos_local")
    op.drop_table("fotos_local")
    op.drop_column("barberos", "foto_jpg")
