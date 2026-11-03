"""videos de la galería (archivos en Supabase Storage; acá solo la ruta) y logo de fondo opcional

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "barberias",
        sa.Column("logo_fondo", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "videos_local",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("barberia_id", UUID(as_uuid=True), sa.ForeignKey("barberias.id"), nullable=False),
        sa.Column("ruta", sa.Text, nullable=False, unique=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("videos_local_barberia", "videos_local", ["barberia_id"])


def downgrade() -> None:
    op.drop_index("videos_local_barberia", table_name="videos_local")
    op.drop_table("videos_local")
    op.drop_column("barberias", "logo_fondo")
