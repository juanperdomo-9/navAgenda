"""Avisos por mail al barbero cuando le sacan o le cancelan un turno (API HTTP de Brevo).

Sin BREVO_API_KEY (o si el barbero no cargó su mail) no se manda nada. El mensaje se arma
mientras la sesión de la base está abierta y se envía después de responder (BackgroundTasks):
un problema con el mail nunca frena una reserva.
"""

import json
import logging
import urllib.error
import urllib.request

from app.core.config import get_settings
from app.core.tz import ZONA_AR
from app.models import Barberia, Barbero, Cliente, Servicio, Turno

log = logging.getLogger(__name__)
URL = "https://api.brevo.com/v3/smtp/email"
DIAS = ("lun", "mar", "mié", "jue", "vie", "sáb", "dom")
Aviso = tuple[str, str, str]  # (para, asunto, texto)


def armar(db, t: Turno, que: str) -> Aviso | None:
    """El aviso de un turno 'nuevo' o 'cancelado'; None si el barbero no tiene mail."""
    x = db.get(Barbero, t.barbero_id)
    if not x or not x.email:
        return None
    b, c = db.get(Barberia, t.barberia_id), db.get(Cliente, t.cliente_id)
    s = db.get(Servicio, t.servicio_id)
    i = t.inicio.astimezone(ZONA_AR)
    cuando = f"{DIAS[i.weekday()]} {i:%d/%m} a las {i:%H:%M}"
    precio = f"$ {t.precio:,}".replace(",", ".")
    if que == "nuevo":
        asunto = f"Nuevo turno: {c.nombre}, {cuando}"
        texto = f"{c.nombre} sacó turno con vos.\n\n{cuando.capitalize()}\n{s.nombre} · {precio}"
    else:
        asunto = f"Cancelado: {c.nombre}, {cuando}"
        texto = (
            f"{c.nombre} canceló su turno.\n\n{cuando.capitalize()}\n{s.nombre}"
            "\n\nEse horario quedó libre otra vez."
        )
    texto += (
        f"\nTeléfono: {c.telefono.removeprefix('+549')}"
        f"\n\nTu agenda: {get_settings().sitio_url}/panel\n\n{b.nombre} · NavAgenda"
    )
    return x.email, asunto, texto


def mandar(aviso: Aviso | None) -> None:
    if aviso:
        _enviar(*aviso)


def _enviar(para: str, asunto: str, texto: str) -> None:
    s = get_settings()
    if not s.brevo_api_key or not s.brevo_remitente:
        return
    cuerpo = {
        "sender": {"name": s.brevo_nombre, "email": s.brevo_remitente},
        "to": [{"email": para}],
        "subject": asunto,
        "textContent": texto,
    }
    pedido = urllib.request.Request(
        URL,
        data=json.dumps(cuerpo).encode(),
        headers={
            "api-key": s.brevo_api_key,
            "content-type": "application/json",
            "accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(pedido, timeout=10):
            pass
    except urllib.error.HTTPError as e:  # Brevo explica el motivo en el cuerpo (sin la clave)
        motivo = e.read().decode(errors="replace")[:300]
        log.warning("No se pudo mandar el aviso a %s: %s %s", para, e.code, motivo)
    except Exception:  # un mail que no sale no tiene que romper nada
        log.warning("No se pudo mandar el aviso a %s", para, exc_info=True)
