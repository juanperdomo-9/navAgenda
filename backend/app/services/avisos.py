"""Avisos por mail (API HTTP de Brevo): al barbero cuando le sacan o le cancelan un turno, y al
cliente que dejó su mail, la confirmación con el ticket y el recordatorio del día anterior.

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


def _datos(db, t: Turno):
    b, x = db.get(Barberia, t.barberia_id), db.get(Barbero, t.barbero_id)
    s = db.get(Servicio, t.servicio_id)
    i = t.inicio.astimezone(ZONA_AR)
    lugar = ", ".join(v for v in (b.direccion, b.barrio, b.ciudad or "La Plata") if v)
    return b, x, s, i, lugar


def confirmacion(db, t: Turno, token: str) -> Aviso | None:
    """Al reservar: el ticket por mail (el link privado solo existe en este momento)."""
    c = db.get(Cliente, t.cliente_id)
    if not c or not c.email:
        return None
    b, x, s, i, lugar = _datos(db, t)
    cuando = f"{DIAS[i.weekday()]} {i:%d/%m} a las {i:%H:%M}"
    url = get_settings().sitio_url
    texto = (
        f"Hola {c.nombre.split(' ')[0]}, tu turno quedó confirmado.\n\n"
        f"{cuando.capitalize()}\nCon {x.nombre} · {s.nombre}\n{lugar}\n\n"
        f"Tu ticket (para verlo o cancelarlo): {url}/t/{token}\n\n"
        f"El día anterior te mandamos un recordatorio.\n\n{b.nombre} · NavAgenda"
    )
    return c.email, f"Turno confirmado: {cuando} en {b.nombre}", texto


def recordatorio(db, t: Turno, token: str) -> Aviso | None:
    """El día anterior: recordatorio del turno de mañana, con el link del ticket."""
    c = db.get(Cliente, t.cliente_id)
    if not c or not c.email:
        return None
    b, x, s, i, lugar = _datos(db, t)
    texto = (
        f"Hola {c.nombre.split(' ')[0]}, te esperamos mañana.\n\n"
        f"{DIAS[i.weekday()].capitalize()} {i:%d/%m} a las {i:%H:%M}\n"
        f"Con {x.nombre} · {s.nombre}\n{lugar}\n\n"
        f"Tu ticket: {get_settings().sitio_url}/t/{token}\n"
        "Si no podés venir, cancelalo desde ahí así otro aprovecha el horario.\n\n"
        f"{b.nombre} · NavAgenda"
    )
    return c.email, f"Mañana a las {i:%H:%M}: tu turno en {b.nombre}", texto


def pedido_opinion(db, t: Turno, token: str) -> Aviso | None:
    """El día después del corte: "¿Cómo te fue?" con el link para dejar la opinión."""
    c = db.get(Cliente, t.cliente_id)
    if not c or not c.email:
        return None
    b, x, _, _, _ = _datos(db, t)
    texto = (
        f"Hola {c.nombre.split(' ')[0]}, ¿cómo te fue ayer con {x.nombre.split(' ')[0]}?\n\n"
        "Contanos en 10 segundos: estrellas y un comentario (o un video corto, si querés). "
        "Ayuda un montón a la barbería.\n\n"
        f"Dejá tu opinión: {get_settings().sitio_url}/t/{token}\n\n"
        f"{b.nombre} · NavAgenda"
    )
    return c.email, f"¿Cómo te fue en {b.nombre}?", texto


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
