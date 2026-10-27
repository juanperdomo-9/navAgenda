"""Modelos de la base. La migración inicial (alembic/versions) refleja exactamente estas tablas.

Convenciones:
- IDs UUID generados por la base (gen_random_uuid).
- Fechas en timestamptz (UTC). Precios en pesos enteros.
- Estados y tipos como texto con CHECK.
- Las tablas hijas llevan barberia_id y FKs compuestas (id, barberia_id), así la base impide
  mezclar datos de dos barberías (ej. un turno con un barbero de otra barbería).
"""

from datetime import datetime, time
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    SmallInteger,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, ExcludeConstraint
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.db.session import Base

ESTADOS_TURNO = ("reservado", "asistio", "no_asistio", "cancelado")
ORIGENES_TURNO = ("web", "manual")
ROLES = ("superadmin", "admin")
# La página de cada barbería vive en la raíz (navagenda.com.ar/<slug>):
# estos slugs son rutas de la app y ninguna barbería los puede usar.
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
    "sumar",
)
ESTADOS_SOLICITUD = ("pendiente", "creada", "descartada")
TIPOS_BENEFICIO = ("descuento_pct", "descuento_monto", "servicio_gratis", "texto")


def _id() -> Mapped[UUID]:
    return mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )


def _creado_en() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


def _barberia_fk() -> Mapped[UUID]:
    return mapped_column(PgUUID(as_uuid=True), ForeignKey("barberias.id"), nullable=False)


def _in(col: str, valores: tuple[str, ...]) -> str:
    return f"{col} IN ({', '.join(repr(v) for v in valores)})"


def _not_in(col: str, valores: tuple[str, ...]) -> str:
    return f"{col} NOT IN ({', '.join(repr(v) for v in valores)})"


class Barberia(Base):
    __tablename__ = "barberias"
    __table_args__ = (
        CheckConstraint(r"slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name="slug_valido"),
        CheckConstraint(_not_in("slug", SLUGS_RESERVADOS), name="slug_no_reservado"),
        CheckConstraint(r"color_acento ~ '^#[0-9a-f]{6}$'", name="color_acento_hex"),
        CheckConstraint("(lat IS NULL) = (lng IS NULL)", name="ubicacion_completa"),
        CheckConstraint("horas_min_cancelacion >= 0", name="horas_cancelacion_no_negativas"),
    )

    id: Mapped[UUID] = _id()
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    logo_url: Mapped[str | None] = mapped_column(Text)
    logo_png: Mapped[bytes | None] = deferred(mapped_column(LargeBinary))
    color_acento: Mapped[str] = mapped_column(Text, nullable=False, server_default="#c9a46a")
    direccion: Mapped[str | None] = mapped_column(Text)
    ciudad: Mapped[str | None] = mapped_column(Text)
    barrio: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    descripcion: Mapped[str | None] = mapped_column(Text)
    horas_min_cancelacion: Mapped[int] = mapped_column(Integer, nullable=False, server_default="3")
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    creado_en: Mapped[datetime] = _creado_en()


class Usuario(Base):
    """Solo admin y superadmin: los clientes no tienen cuenta."""

    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint(_in("rol", ROLES), name="rol_valido"),
        CheckConstraint("(rol = 'superadmin') = (barberia_id IS NULL)", name="barberia_segun_rol"),
        Index("usuarios_usuario_unico", text("lower(usuario)"), unique=True),
    )

    id: Mapped[UUID] = _id()
    barberia_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("barberias.id")
    )
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    usuario: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    rol: Mapped[str] = mapped_column(Text, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    # Clave temporal (creada o reseteada por el superadmin): hay que cambiarla al entrar.
    debe_cambiar_clave: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    # Contra fuerza bruta: tras varios intentos fallidos la cuenta se bloquea un rato.
    intentos_fallidos: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ultimo_ingreso: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = _creado_en()


class Barbero(Base):
    __tablename__ = "barberos"
    __table_args__ = (UniqueConstraint("id", "barberia_id", name="barberos_id_barberia"),)

    id: Mapped[UUID] = _id()
    barberia_id: Mapped[UUID] = _barberia_fk()
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    foto_url: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    creado_en: Mapped[datetime] = _creado_en()


class HorarioBarbero(Base):
    """Tramo de trabajo semanal. Puede haber varios por día (ej. 10–14 y 16–20)."""

    __tablename__ = "horarios_barbero"
    __table_args__ = (
        CheckConstraint("dia_semana BETWEEN 0 AND 6", name="dia_semana_valido"),  # 0 = lunes
        CheckConstraint("desde < hasta", name="tramo_valido"),
    )

    id: Mapped[UUID] = _id()
    barbero_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("barberos.id", ondelete="CASCADE"), nullable=False
    )
    dia_semana: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    desde: Mapped[time] = mapped_column(Time, nullable=False)
    hasta: Mapped[time] = mapped_column(Time, nullable=False)


class Servicio(Base):
    __tablename__ = "servicios"
    __table_args__ = (
        UniqueConstraint("id", "barberia_id", name="servicios_id_barberia"),
        CheckConstraint("precio >= 0", name="precio_no_negativo"),
        CheckConstraint("duracion_min > 0 AND duracion_min % 5 = 0", name="duracion_multiplo_5"),
    )

    id: Mapped[UUID] = _id()
    barberia_id: Mapped[UUID] = _barberia_fk()
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    precio: Mapped[int] = mapped_column(Integer, nullable=False)
    duracion_min: Mapped[int] = mapped_column(Integer, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    creado_en: Mapped[datetime] = _creado_en()


class BarberoServicio(Base):
    """Qué servicios hace cada barbero."""

    __tablename__ = "barbero_servicios"
    __table_args__ = (
        ForeignKeyConstraint(
            ["barbero_id", "barberia_id"],
            ["barberos.id", "barberos.barberia_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["servicio_id", "barberia_id"],
            ["servicios.id", "servicios.barberia_id"],
            ondelete="CASCADE",
        ),
    )

    barbero_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True)
    servicio_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True)
    barberia_id: Mapped[UUID] = _barberia_fk()


class Cliente(Base):
    """Cliente de una barbería, identificado por su teléfono (sin cuenta)."""

    __tablename__ = "clientes"
    __table_args__ = (
        UniqueConstraint("barberia_id", "telefono", name="clientes_telefono_por_barberia"),
        UniqueConstraint("id", "barberia_id", name="clientes_id_barberia"),
        CheckConstraint(r"telefono ~ '^\+[1-9][0-9]{7,14}$'", name="telefono_e164"),
    )

    id: Mapped[UUID] = _id()
    barberia_id: Mapped[UUID] = _barberia_fk()
    telefono: Mapped[str] = mapped_column(Text, nullable=False)
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    bloqueado: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    creado_en: Mapped[datetime] = _creado_en()


class Turno(Base):
    __tablename__ = "turnos"
    __table_args__ = (
        ForeignKeyConstraint(
            ["barbero_id", "barberia_id"], ["barberos.id", "barberos.barberia_id"]
        ),
        ForeignKeyConstraint(
            ["cliente_id", "barberia_id"], ["clientes.id", "clientes.barberia_id"]
        ),
        ForeignKeyConstraint(
            ["servicio_id", "barberia_id"], ["servicios.id", "servicios.barberia_id"]
        ),
        CheckConstraint("fin > inicio", name="rango_valido"),
        CheckConstraint("precio >= 0", name="precio_no_negativo"),
        CheckConstraint(_in("estado", ESTADOS_TURNO), name="estado_valido"),
        CheckConstraint(_in("origen", ORIGENES_TURNO), name="origen_valido"),
        Index("turnos_barberia_inicio", "barberia_id", "inicio"),
        Index("turnos_cliente", "cliente_id"),
        # Nunca dos turnos superpuestos del mismo barbero. '[)' permite turnos pegados
        # (10:00–10:30 y 10:30–11:00). Los cancelados liberan el horario. Requiere btree_gist.
        ExcludeConstraint(
            ("barbero_id", "="),
            (text("tstzrange(inicio, fin, '[)')"), "&&"),
            name="turnos_sin_superposicion",
            using="gist",
            where=text("estado <> 'cancelado'"),
        ),
    )

    id: Mapped[UUID] = _id()
    barberia_id: Mapped[UUID] = _barberia_fk()
    barbero_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False)
    cliente_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False)
    servicio_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False)
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fin: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    precio: Mapped[int] = mapped_column(Integer, nullable=False)
    estado: Mapped[str] = mapped_column(Text, nullable=False, server_default="reservado")
    beneficio_aplicado: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    # Lo que se cobró al marcar "asistió" (con el premio aplicado). Null = el precio.
    cobrado: Mapped[int | None] = mapped_column(Integer)
    token_acceso_hash: Mapped[str | None] = mapped_column(Text, unique=True)
    origen: Mapped[str] = mapped_column(Text, nullable=False, server_default="web")
    creado_en: Mapped[datetime] = _creado_en()


class Solicitud(Base):
    """Pedido para sumar una barbería ("Quiero sumar mi barbería"). La da de alta el superadmin."""

    __tablename__ = "solicitudes"
    __table_args__ = (CheckConstraint(_in("estado", ESTADOS_SOLICITUD), name="estado_valido"),)

    id: Mapped[UUID] = _id()
    barberia: Mapped[str] = mapped_column(Text, nullable=False)
    nombre: Mapped[str] = mapped_column(Text, nullable=False)
    telefono: Mapped[str] = mapped_column(Text, nullable=False)
    barrio: Mapped[str | None] = mapped_column(Text)
    mensaje: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(Text, nullable=False, server_default="pendiente")
    creado_en: Mapped[datetime] = _creado_en()


class Bloqueo(Base):
    """Horario no disponible de un barbero (almuerzo, trámite, vacaciones = día completo)."""

    __tablename__ = "bloqueos"
    __table_args__ = (
        ForeignKeyConstraint(
            ["barbero_id", "barberia_id"],
            ["barberos.id", "barberos.barberia_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("fin > inicio", name="rango_valido"),
        Index("bloqueos_barbero_inicio", "barbero_id", "inicio"),
    )

    id: Mapped[UUID] = _id()
    barberia_id: Mapped[UUID] = _barberia_fk()
    barbero_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False)
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fin: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    motivo: Mapped[str | None] = mapped_column(Text)
    creado_en: Mapped[datetime] = _creado_en()


class ReglaBeneficio(Base):
    """'Cada X cortes asistidos → beneficio'. Una sola regla activa por barbería."""

    __tablename__ = "reglas_beneficio"
    __table_args__ = (
        ForeignKeyConstraint(
            ["servicio_id", "barberia_id"], ["servicios.id", "servicios.barberia_id"]
        ),
        CheckConstraint("cada_x_cortes >= 1", name="cada_x_positivo"),
        CheckConstraint(_in("tipo", TIPOS_BENEFICIO), name="tipo_valido"),
        CheckConstraint("modo IN ('fijo', 'ruleta')", name="modo_valido"),
        CheckConstraint(
            "(tipo <> 'descuento_pct' OR valor BETWEEN 1 AND 100)"
            " AND (tipo <> 'descuento_monto' OR valor > 0)"
            " AND (tipo <> 'servicio_gratis' OR servicio_id IS NOT NULL)",
            name="valor_segun_tipo",
        ),
        Index(
            "reglas_una_activa_por_barberia",
            "barberia_id",
            unique=True,
            postgresql_where=text("activa"),
        ),
    )

    id: Mapped[UUID] = _id()
    barberia_id: Mapped[UUID] = _barberia_fk()
    cada_x_cortes: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo: Mapped[str] = mapped_column(Text, nullable=False)
    valor: Mapped[int | None] = mapped_column(Integer)
    servicio_id: Mapped[UUID | None] = mapped_column(PgUUID(as_uuid=True))
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    creado_en: Mapped[datetime] = _creado_en()
    # "fijo": siempre el mismo premio. "ruleta": al completar la tarjeta el cliente gira una
    # ruleta con estos premios ([{"texto", "descuento_pct" 0..100}]), todos con la misma chance.
    modo: Mapped[str] = mapped_column(Text, nullable=False, server_default="fijo")
    ruleta: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))


class Giro(Base):
    """Lo que le salió a un cliente en la ruleta. Se usa una vez, al aplicar el premio."""

    __tablename__ = "giros"
    __table_args__ = (
        ForeignKeyConstraint(
            ["cliente_id", "barberia_id"],
            ["clientes.id", "clientes.barberia_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("descuento_pct BETWEEN 0 AND 100", name="descuento_valido"),
    )

    id: Mapped[UUID] = _id()
    barberia_id: Mapped[UUID] = _barberia_fk()
    cliente_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False)
    premio: Mapped[str] = mapped_column(Text, nullable=False)
    descuento_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    turno_id: Mapped[UUID | None] = mapped_column(PgUUID(as_uuid=True), ForeignKey("turnos.id"))
    usado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = _creado_en()


class Fidelidad(Base):
    """Contador de cortes asistidos de un cliente (teléfono) en una barbería."""

    __tablename__ = "fidelidad"
    __table_args__ = (
        ForeignKeyConstraint(
            ["cliente_id", "barberia_id"],
            ["clientes.id", "clientes.barberia_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("cortes_acumulados >= 0", name="cortes_no_negativos"),
        CheckConstraint("beneficios_disponibles >= 0", name="beneficios_no_negativos"),
    )

    cliente_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True)
    barberia_id: Mapped[UUID] = _barberia_fk()
    cortes_acumulados: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    beneficios_disponibles: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
