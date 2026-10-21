"""Contraste del color de acento de una barbería.

El color es el fondo de su página ("su rollo"). La tinta se elige sola entre la tinta oscura y el
papel claro de NavAgenda, así que un color sirve si con alguna de las dos llega a contraste AA.
Misma lógica que el frontend (design/barberia: aplicarColor).
"""

import re

TINTA = "#141210"
PAPEL = "#fffdf3"
HEX = re.compile(r"^#[0-9a-f]{6}$")


def luminancia(hex_: str) -> float:
    canales = []
    for i in (1, 3, 5):
        c = int(hex_[i : i + 2], 16) / 255
        canales.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = canales
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a: str, b: str) -> float:
    la, lb = luminancia(a), luminancia(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def tinta_para(fondo: str) -> str:
    return TINTA if contraste(fondo, TINTA) >= contraste(fondo, PAPEL) else PAPEL


def acento_valido(hex_: str) -> bool:
    return bool(HEX.match(hex_)) and contraste(hex_, tinta_para(hex_)) >= 4.5
