"""Claves (argon2), sesiones (JWT en cookie httpOnly) y freno de fuerza bruta."""

import secrets
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from threading import Lock
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

COOKIE_SESION = "navagenda_sesion"
ALGORITMO = "HS256"

# Bloqueo por cuenta: tras 5 claves mal, 15 minutos sin poder entrar.
MAX_INTENTOS = 5
MINUTOS_BLOQUEO = 15

_hasher = PasswordHasher()
# Hash de referencia para comparar cuando el usuario no existe: tarda lo mismo y no delata
# qué usuarios existen.
_HASH_FALSO = _hasher.hash(secrets.token_urlsafe(16))


def hashear_clave(clave: str) -> str:
    return _hasher.hash(clave)


def verificar_clave(clave: str, hash_guardado: str | None) -> bool:
    try:
        return _hasher.verify(hash_guardado or _HASH_FALSO, clave) and hash_guardado is not None
    except (VerificationError, InvalidHashError):
        return False


def necesita_rehash(hash_guardado: str) -> bool:
    return _hasher.check_needs_rehash(hash_guardado)


def clave_temporal() -> str:
    """Clave para entregar en mano: legible, sin caracteres ambiguos, 12 caracteres."""
    alfabeto = "abcdefghjkmnpqrstuvwxyz23456789"
    return "-".join("".join(secrets.choice(alfabeto) for _ in range(4)) for _ in range(3))


def crear_token(usuario_id: UUID, rol: str, barberia_id: UUID | None) -> str:
    ahora = datetime.now(UTC)
    payload = {
        "sub": str(usuario_id),
        "rol": rol,
        "bid": str(barberia_id) if barberia_id else None,
        "iat": ahora,
        "exp": ahora + timedelta(hours=get_settings().sesion_horas),
    }
    return jwt.encode(payload, get_settings().clave_jwt, algorithm=ALGORITMO)


def leer_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, get_settings().clave_jwt, algorithms=[ALGORITMO])
    except jwt.PyJWTError:
        return None


class LimitePorIP:
    """Ventana deslizante en memoria: máximo `maximo` intentos por IP cada `segundos`.

    Alcanza para una sola instancia en Render. Si se escala a varias, mover a Postgres o Redis.
    """

    def __init__(self, maximo: int = 20, segundos: int = 15 * 60) -> None:
        self.maximo = maximo
        self.segundos = segundos
        self._intentos: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def permitir(self, ip: str) -> bool:
        ahora = time.monotonic()
        with self._lock:
            cola = self._intentos[ip]
            while cola and ahora - cola[0] > self.segundos:
                cola.popleft()
            if len(cola) >= self.maximo:
                return False
            cola.append(ahora)
            return True

    def reiniciar(self) -> None:
        with self._lock:
            self._intentos.clear()


limite_login = LimitePorIP()
