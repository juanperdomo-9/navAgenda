"""Comandos de administración.

Cargar la primera barbería: uv run python -m app.cli cargar-inspirationmen

Crear el superadmin (pide la clave por consola, no queda en el historial):
    uv run python -m app.cli crear-superadmin <usuario> "<nombre>"

Primer arranque en producción (lo corre Render antes de levantar la API; no hace nada si ya está):
    uv run python -m app.cli inicial
"""

import argparse
import getpass
import os
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hashear_clave
from app.db.session import get_engine
from app.models import Usuario
from app.schemas.auth import CLAVE_MIN
from app.services.auth import buscar_por_usuario


def crear_superadmin(usuario: str, nombre: str, generar: bool = False) -> int:
    with Session(get_engine()) as db, db.begin():
        if buscar_por_usuario(db, usuario):
            print(f"El usuario '{usuario}' ya existe.", file=sys.stderr)
            return 1
        if generar:
            # Clave temporal al azar: se muestra una vez y hay que cambiarla al entrar.
            from app.core.security import clave_temporal

            clave = clave_temporal()
            db.add(
                Usuario(
                    nombre=nombre,
                    usuario=usuario,
                    password_hash=hashear_clave(clave),
                    rol="superadmin",
                    debe_cambiar_clave=True,
                )
            )
            print(f"Listo: superadmin '{usuario}'. Clave temporal: {clave} (la cambiás al entrar).")
            return 0
        clave = getpass.getpass("Clave (no se muestra): ")
        if len(clave) < CLAVE_MIN:
            print(f"La clave tiene que tener al menos {CLAVE_MIN} caracteres.", file=sys.stderr)
            return 1
        if getpass.getpass("Repetila: ") != clave:
            print("Las claves no coinciden.", file=sys.stderr)
            return 1
        db.add(
            Usuario(
                nombre=nombre, usuario=usuario, password_hash=hashear_clave(clave), rol="superadmin"
            )
        )
    print(f"Listo: superadmin '{usuario}' creado.")
    return 0


def cargar_inspirationmen() -> int:
    from app.db import inspirationmen

    with Session(get_engine()) as db, db.begin():
        clave = inspirationmen.cargar(db)
    if clave is None:
        print("Inspirationmen ya estaba cargada: no se cambió nada.")
    else:
        print("Listo: Inspirationmen cargada (navagenda.com.ar/inspirationmen).")
        print(f"Admin: usuario 'inspirationmen', clave temporal {clave} (se cambia al entrar).")
    return 0


SUPERADMIN = ("juan", "Juan Perdomo")


def preparar_inicial(db: Session, hashes: dict[str, str] | None = None) -> list[str]:
    """Crea el superadmin y carga Inspirationmen si faltan, con claves temporales al azar.

    `hashes`: {usuario: hash argon2} de claves temporales que se cargan como variables
    CLAVE_TEMPORAL_<USUARIO> en Render (sin Shell y sin que la clave pase por los logs).
    Solo se aplican mientras el usuario todavía no eligió su clave. Devuelve las líneas a mostrar.
    """
    from app.core.security import clave_temporal
    from app.db import inspirationmen

    avisos = []
    if not db.scalar(select(Usuario.id).where(Usuario.rol == "superadmin")):
        clave = clave_temporal()
        db.add(
            Usuario(
                usuario=SUPERADMIN[0],
                nombre=SUPERADMIN[1],
                password_hash=hashear_clave(clave),
                rol="superadmin",
                debe_cambiar_clave=True,
            )
        )
        avisos.append(f"Superadmin '{SUPERADMIN[0]}' creado (clave: variable CLAVE_TEMPORAL_JUAN)")
    if inspirationmen.cargar(db):
        avisos.append("Inspirationmen cargada (clave: variable CLAVE_TEMPORAL_INSPIRATIONMEN)")
    db.flush()
    for nombre, h in (hashes or {}).items():
        u = buscar_por_usuario(db, nombre)
        if not u or not h.startswith("$argon2"):
            avisos.append(f"CLAVE_TEMPORAL de '{nombre}' ignorada (usuario o hash inválido)")
        elif u.debe_cambiar_clave and u.password_hash != h:
            u.password_hash, u.intentos_fallidos, u.bloqueado_hasta = h, 0, None
            avisos.append(f"Usuario '{u.usuario}': clave temporal aplicada")
    return avisos


def _hashes_del_entorno() -> dict[str, str]:
    """CLAVE_TEMPORAL_JUAN=... → {"juan": ...}; los guiones del usuario van como "_"."""
    pre = "CLAVE_TEMPORAL_"
    return {
        k[len(pre) :].lower().replace("_", "-"): v.strip()
        for k, v in os.environ.items()
        if k.startswith(pre) and v.strip()
    }


def inicial() -> int:
    with Session(get_engine()) as db, db.begin():
        avisos = preparar_inicial(db, _hashes_del_entorno())
    for a in avisos:
        print(f"[NavAgenda] {a}", flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("crear-superadmin", help="Crea el usuario superadmin")
    p.add_argument("usuario")
    p.add_argument("nombre")
    p.add_argument(
        "--generar", action="store_true", help="Genera una clave temporal en vez de pedirla"
    )
    sub.add_parser("cargar-inspirationmen", help="Carga la barbería Inspirationmen")
    sub.add_parser("inicial", help="Superadmin e Inspirationmen si faltan (primer arranque)")
    args = parser.parse_args()
    if args.cmd == "inicial":
        return inicial()
    if args.cmd == "cargar-inspirationmen":
        return cargar_inspirationmen()
    if args.cmd == "crear-superadmin":
        return crear_superadmin(args.usuario, args.nombre, args.generar)
    return 1


if __name__ == "__main__":
    sys.exit(main())
