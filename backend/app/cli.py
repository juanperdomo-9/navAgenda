"""Comandos de administración.

Crear el superadmin (pide la clave por consola, no queda en el historial):
    uv run python -m app.cli crear-superadmin <usuario> "<nombre>"
"""

import argparse
import getpass
import sys

from sqlalchemy.orm import Session

from app.core.security import hashear_clave
from app.db.session import get_engine
from app.models import Usuario
from app.schemas.auth import CLAVE_MIN
from app.services.auth import buscar_por_usuario


def crear_superadmin(usuario: str, nombre: str) -> int:
    with Session(get_engine()) as db, db.begin():
        if buscar_por_usuario(db, usuario):
            print(f"El usuario '{usuario}' ya existe.", file=sys.stderr)
            return 1
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


def main() -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("crear-superadmin", help="Crea el usuario superadmin")
    p.add_argument("usuario")
    p.add_argument("nombre")
    args = parser.parse_args()
    if args.cmd == "crear-superadmin":
        return crear_superadmin(args.usuario, args.nombre)
    return 1


if __name__ == "__main__":
    sys.exit(main())
