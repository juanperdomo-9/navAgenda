"""esquema inicial

Revision ID: 0001
Revises:
Create Date: 2026-10-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = pg.UUID(as_uuid=True)
TS = sa.DateTime(timezone=True)


def _id() -> sa.Column:
    return sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _creado_en() -> sa.Column:
    return sa.Column("creado_en", TS, nullable=False, server_default=sa.func.now())


def _barberia_id() -> sa.Column:
    return sa.Column("barberia_id", UUID, sa.ForeignKey("barberias.id"), nullable=False)


def upgrade() -> None:
    # btree_gist permite combinar "=" sobre uuid con "&&" sobre rangos en la restricción EXCLUDE.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "barberias",
        _id(),
        sa.Column("nombre", sa.Text, nullable=False),
        sa.Column("slug", sa.Text, nullable=False, unique=True),
        sa.Column("logo_url", sa.Text),
        sa.Column("color_acento", sa.Text, nullable=False, server_default="#c9a46a"),
        sa.Column("direccion", sa.Text),
        sa.Column("ciudad", sa.Text),
        sa.Column("barrio", sa.Text),
        sa.Column("lat", sa.Numeric(9, 6)),
        sa.Column("lng", sa.Numeric(9, 6)),
        sa.Column("descripcion", sa.Text),
        sa.Column("horas_min_cancelacion", sa.Integer, nullable=False, server_default="3"),
        sa.Column("activa", sa.Boolean, nullable=False, server_default=sa.text("true")),
        _creado_en(),
        sa.CheckConstraint(r"slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name="slug_valido"),
        sa.CheckConstraint(r"color_acento ~ '^#[0-9a-f]{6}$'", name="color_acento_hex"),
        sa.CheckConstraint("(lat IS NULL) = (lng IS NULL)", name="ubicacion_completa"),
        sa.CheckConstraint("horas_min_cancelacion >= 0", name="horas_cancelacion_no_negativas"),
    )

    op.create_table(
        "usuarios",
        _id(),
        sa.Column("barberia_id", UUID, sa.ForeignKey("barberias.id")),
        sa.Column("nombre", sa.Text, nullable=False),
        sa.Column("usuario", sa.Text, nullable=False),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("rol", sa.Text, nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("true")),
        _creado_en(),
        sa.CheckConstraint("rol IN ('superadmin', 'admin')", name="rol_valido"),
        sa.CheckConstraint(
            "(rol = 'superadmin') = (barberia_id IS NULL)", name="barberia_segun_rol"
        ),
    )
    op.create_index("usuarios_usuario_unico", "usuarios", [sa.text("lower(usuario)")], unique=True)

    op.create_table(
        "barberos",
        _id(),
        _barberia_id(),
        sa.Column("nombre", sa.Text, nullable=False),
        sa.Column("foto_url", sa.Text),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("true")),
        _creado_en(),
        sa.UniqueConstraint("id", "barberia_id", name="barberos_id_barberia"),
    )

    op.create_table(
        "horarios_barbero",
        _id(),
        sa.Column(
            "barbero_id", UUID, sa.ForeignKey("barberos.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("dia_semana", sa.SmallInteger, nullable=False),
        sa.Column("desde", sa.Time, nullable=False),
        sa.Column("hasta", sa.Time, nullable=False),
        sa.CheckConstraint("dia_semana BETWEEN 0 AND 6", name="dia_semana_valido"),
        sa.CheckConstraint("desde < hasta", name="tramo_valido"),
    )

    op.create_table(
        "servicios",
        _id(),
        _barberia_id(),
        sa.Column("nombre", sa.Text, nullable=False),
        sa.Column("precio", sa.Integer, nullable=False),
        sa.Column("duracion_min", sa.Integer, nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("true")),
        _creado_en(),
        sa.UniqueConstraint("id", "barberia_id", name="servicios_id_barberia"),
        sa.CheckConstraint("precio >= 0", name="precio_no_negativo"),
        sa.CheckConstraint("duracion_min > 0 AND duracion_min % 5 = 0", name="duracion_multiplo_5"),
    )

    op.create_table(
        "barbero_servicios",
        sa.Column("barbero_id", UUID, primary_key=True),
        sa.Column("servicio_id", UUID, primary_key=True),
        _barberia_id(),
        sa.ForeignKeyConstraint(
            ["barbero_id", "barberia_id"],
            ["barberos.id", "barberos.barberia_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["servicio_id", "barberia_id"],
            ["servicios.id", "servicios.barberia_id"],
            ondelete="CASCADE",
        ),
    )

    op.create_table(
        "clientes",
        _id(),
        _barberia_id(),
        sa.Column("telefono", sa.Text, nullable=False),
        sa.Column("nombre", sa.Text, nullable=False),
        sa.Column("bloqueado", sa.Boolean, nullable=False, server_default=sa.text("false")),
        _creado_en(),
        sa.UniqueConstraint("barberia_id", "telefono", name="clientes_telefono_por_barberia"),
        sa.UniqueConstraint("id", "barberia_id", name="clientes_id_barberia"),
        sa.CheckConstraint(r"telefono ~ '^\+[1-9][0-9]{7,14}$'", name="telefono_e164"),
    )

    op.create_table(
        "turnos",
        _id(),
        _barberia_id(),
        sa.Column("barbero_id", UUID, nullable=False),
        sa.Column("cliente_id", UUID, nullable=False),
        sa.Column("servicio_id", UUID, nullable=False),
        sa.Column("inicio", TS, nullable=False),
        sa.Column("fin", TS, nullable=False),
        sa.Column("precio", sa.Integer, nullable=False),
        sa.Column("estado", sa.Text, nullable=False, server_default="reservado"),
        sa.Column(
            "beneficio_aplicado", sa.Boolean, nullable=False, server_default=sa.text("false")
        ),
        sa.Column("token_acceso_hash", sa.Text, unique=True),
        sa.Column("origen", sa.Text, nullable=False, server_default="web"),
        _creado_en(),
        sa.ForeignKeyConstraint(
            ["barbero_id", "barberia_id"], ["barberos.id", "barberos.barberia_id"]
        ),
        sa.ForeignKeyConstraint(
            ["cliente_id", "barberia_id"], ["clientes.id", "clientes.barberia_id"]
        ),
        sa.ForeignKeyConstraint(
            ["servicio_id", "barberia_id"], ["servicios.id", "servicios.barberia_id"]
        ),
        sa.CheckConstraint("fin > inicio", name="rango_valido"),
        sa.CheckConstraint("precio >= 0", name="precio_no_negativo"),
        sa.CheckConstraint(
            "estado IN ('reservado', 'asistio', 'no_asistio', 'cancelado')", name="estado_valido"
        ),
        sa.CheckConstraint("origen IN ('web', 'manual')", name="origen_valido"),
        pg.ExcludeConstraint(
            ("barbero_id", "="),
            (sa.text("tstzrange(inicio, fin, '[)')"), "&&"),
            name="turnos_sin_superposicion",
            using="gist",
            where=sa.text("estado <> 'cancelado'"),
        ),
    )
    op.create_index("turnos_barberia_inicio", "turnos", ["barberia_id", "inicio"])
    op.create_index("turnos_cliente", "turnos", ["cliente_id"])

    op.create_table(
        "bloqueos",
        _id(),
        _barberia_id(),
        sa.Column("barbero_id", UUID, nullable=False),
        sa.Column("inicio", TS, nullable=False),
        sa.Column("fin", TS, nullable=False),
        sa.Column("motivo", sa.Text),
        _creado_en(),
        sa.ForeignKeyConstraint(
            ["barbero_id", "barberia_id"],
            ["barberos.id", "barberos.barberia_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("fin > inicio", name="rango_valido"),
    )
    op.create_index("bloqueos_barbero_inicio", "bloqueos", ["barbero_id", "inicio"])

    op.create_table(
        "reglas_beneficio",
        _id(),
        _barberia_id(),
        sa.Column("cada_x_cortes", sa.Integer, nullable=False),
        sa.Column("tipo", sa.Text, nullable=False),
        sa.Column("valor", sa.Integer),
        sa.Column("servicio_id", UUID),
        sa.Column("descripcion", sa.Text, nullable=False),
        sa.Column("activa", sa.Boolean, nullable=False, server_default=sa.text("true")),
        _creado_en(),
        sa.ForeignKeyConstraint(
            ["servicio_id", "barberia_id"], ["servicios.id", "servicios.barberia_id"]
        ),
        sa.CheckConstraint("cada_x_cortes >= 1", name="cada_x_positivo"),
        sa.CheckConstraint(
            "tipo IN ('descuento_pct', 'descuento_monto', 'servicio_gratis', 'texto')",
            name="tipo_valido",
        ),
        sa.CheckConstraint(
            "(tipo <> 'descuento_pct' OR valor BETWEEN 1 AND 100)"
            " AND (tipo <> 'descuento_monto' OR valor > 0)"
            " AND (tipo <> 'servicio_gratis' OR servicio_id IS NOT NULL)",
            name="valor_segun_tipo",
        ),
    )
    op.create_index(
        "reglas_una_activa_por_barberia",
        "reglas_beneficio",
        ["barberia_id"],
        unique=True,
        postgresql_where=sa.text("activa"),
    )

    op.create_table(
        "fidelidad",
        sa.Column("cliente_id", UUID, primary_key=True),
        _barberia_id(),
        sa.Column("cortes_acumulados", sa.Integer, nullable=False, server_default="0"),
        sa.Column("beneficios_disponibles", sa.Integer, nullable=False, server_default="0"),
        sa.Column("actualizado_en", TS, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["cliente_id", "barberia_id"],
            ["clientes.id", "clientes.barberia_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("cortes_acumulados >= 0", name="cortes_no_negativos"),
        sa.CheckConstraint("beneficios_disponibles >= 0", name="beneficios_no_negativos"),
    )


def downgrade() -> None:
    for tabla in (
        "fidelidad",
        "reglas_beneficio",
        "bloqueos",
        "turnos",
        "clientes",
        "barbero_servicios",
        "servicios",
        "horarios_barbero",
        "barberos",
        "usuarios",
        "barberias",
    ):
        op.drop_table(tabla)
