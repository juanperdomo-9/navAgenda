"""Lee el PDF "Sumá tu barbería" completado y arma una propuesta de alta para revisar.

El formulario tiene 129 campos (c1…c129) en el orden en que los dibuja el generador; acá se
leen por posición. No escribe nada en la base: devuelve lo que entendió, con avisos donde
hubo que adivinar (horarios escritos a mano, colores que no son de la lista, etc.).
"""

import io
import re
import unicodedata

from pypdf import PdfReader

DIAS = ("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo")
ABREV = {"lun": 0, "mar": 1, "mie": 2, "jue": 3, "vie": 4, "sab": 5, "dom": 6}
COLORES = ("#c9a46a", "#c47f57", "#d4a24c", "#1f3a5f", "#2f6b4f", "#7a1f2b", "#141210")


def _plano(t: str) -> str:
    t = unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode()
    return t.lower().strip()


def _campos(pdf: bytes) -> dict[int, str | bool]:
    r = PdfReader(io.BytesIO(pdf))
    out: dict[int, str | bool] = {}
    for nombre, f in (r.get_fields() or {}).items():
        m = re.fullmatch(r"c(\d+)", nombre)
        if not m:
            continue
        v = f.get("/V")
        if f.get("/FT") == "/Btn":
            out[int(m[1])] = v not in (None, "", "/Off", "Off")
        else:
            out[int(m[1])] = str(v or "").strip()
    return out


def hora(t: str) -> str | None:
    """'10' / '10hs' / '10:30' / '10.30' / '9 30' → 'HH:MM' (redondeado a 5 min)."""
    m = re.search(r"(\d{1,2})(?:\s*[:.,h]\s*|\s+)?(\d{2})?", t or "")
    if not m:
        return None
    h, mi = int(m[1]), int(m[2] or 0)
    if h > 24 or mi > 59:
        return None
    mi = mi - mi % 5
    return "23:55" if h == 24 else f"{h:02d}:{mi:02d}"


def _rango_horas(t: str) -> tuple[str, str] | None:
    """'10 a 18', 'de 10:30 a 19', '10-18', '10 hs a 20 hs' → ('10:00', '18:00')."""
    ns = re.findall(r"\d{1,2}(?:\s*[:.]\s*\d{2})?", t or "")
    if len(ns) < 2:
        return None
    a, z = hora(ns[0]), hora(ns[1])
    return (a, z) if a and z and a < z else None


def _dias(t: str) -> list[int]:
    """'lun a vie', 'lunes, miércoles y viernes', 'sáb', 'martes-sábado' → [0..6]."""
    t = _plano(t)
    if re.search(r"\btodos\s+los\s+dias\b", t):
        return list(range(7))
    toks = re.findall(r"\b(?:(lun|mar|mie|jue|vie|sab|dom)[a-z]*|(a|al|hasta))\b|(-)", t)
    toks = [(d, sep or guion) for d, sep, guion in toks]
    dias, desde, rango = [], None, False
    for d, sep in toks:
        if sep:
            rango = desde is not None
            continue
        n = ABREV[d]
        if rango and desde is not None:
            dias += list(range(desde + 1, n + 1)) if n >= desde else []
            rango = False
        else:
            dias.append(n)
        desde = n
    return sorted(set(dias))


def tramos_de_texto(t: str) -> list[dict]:
    """'lun a vie 10 a 18, sáb 9 a 14' → tramos por día. Con corte: 'lun a vie 10 a 13 y 16 a 20'"""
    out, previos = [], []
    for parte in re.split(r"[;,\n]", t or ""):
        dias = sorted(set(previos + _dias(re.split(r"\d", parte, maxsplit=1)[0])))
        if not re.search(r"\d", parte):  # "lunes, miércoles y viernes 10 a 18": los días siguen
            previos = dias
            continue
        previos = []
        if not dias:
            continue
        nums = re.findall(r"\d{1,2}(?:\s*[:.]\s*\d{2})?", parte)
        for i in range(0, len(nums) - 1, 2):
            r = _rango_horas(f"{nums[i]} {nums[i + 1]}")
            if r:
                out += [{"dia_semana": d, "desde": r[0], "hasta": r[1]} for d in dias]
    return out


def _numero(t: str) -> int | None:
    d = re.sub(r"[^\d]", "", (t or "").split(",")[0])
    return int(d) if d else None


def _nombres(t: str, opciones: list[str]) -> list[str] | None:
    """Qué nombres de `opciones` aparecen en `t`; None = todos (vacío, 'todos', 'todo')."""
    p = _plano(t)
    if not p or re.search(r"\btod[oa]s?\b", p):
        return None
    palabras = set(re.findall(r"[a-z0-9]+", p))
    primeras = [_plano(o).split()[0] for o in opciones]

    def nombra(o: str) -> bool:
        completo = re.search(rf"(?<![a-z0-9]){re.escape(_plano(o))}(?![a-z0-9])", p)
        # El nombre de pila alcanza si nadie más se llama igual ("Martín" → "Martín Sosa")
        pila = _plano(o).split()[0]
        unica = pila in palabras and primeras.count(pila) == 1 and " " in o.strip()
        return bool(completo) or unica

    encontrados = [o for o in opciones if nombra(o)]
    # "Corte + barba" nombra también "Corte": vale el nombre más largo que lo contiene
    encontrados = [
        o
        for o in encontrados
        if not any(
            o != x and _plano(o) in _plano(x) and re.search(re.escape(_plano(x)), p)
            for x in encontrados
        )
    ]
    return encontrados or None


def leer(pdf: bytes) -> dict:
    c = _campos(pdf)
    if len(c) < 120:
        raise ValueError("Ese PDF no es el formulario 'Sumá tu barbería' de NavAgenda.")
    s = lambda n: c.get(n) if isinstance(c.get(n), str) else ""  # noqa: E731
    b = lambda n: c.get(n) is True  # noqa: E731
    avisos: list[str] = []

    # 01 · La barbería
    color = next((COLORES[i] for i in range(7) if b(8 + i)), None)
    otro = s(15)
    if not color and re.fullmatch(r"#?[0-9a-fA-F]{6}", otro):
        color = "#" + otro.lstrip("#").lower()
    elif not color and otro:
        avisos.append(f'Color: escribió "{otro}". Elegilo a mano.')
    horas = _numero(s(16))
    barberia = {
        "nombre": s(1),
        "barrio": s(2),
        "direccion": s(3),
        "ciudad": s(4) or "La Plata",
        "slug": re.sub(r"[^a-z0-9]+", "-", _plano(s(5) or s(1))).strip("-"),
        "whatsapp": s(6),
        "instagram": s(7),
        "color_acento": color or "#c9a46a",
        "horas_min_cancelacion": min(horas, 72) if horas is not None else 3,
        "descripcion": s(17),
    }
    pendientes = []
    if b(18):
        pendientes.append("Te manda el logo por WhatsApp: subilo en Mi página → Logo.")
    if b(22):
        pendientes.append("Te manda fotos del local: subilas en Mi página → Fotos del local.")

    # 02 · Quién maneja el panel
    admin = {
        "nombre": s(24),
        "whatsapp": s(25),
        "usuario": re.sub(r"[^a-z0-9._-]", "", _plano(s(26)) or barberia["slug"]),
    }

    # 03 · Horario de atención (4 campos por día desde c27: abre, cierra, corte, cerrado)
    local = []
    for d in range(7):
        n = 27 + d * 4
        if b(n + 3):
            continue
        a, z = hora(s(n)), hora(s(n + 1))
        if not (a and z and a < z):
            if s(n) or s(n + 1):
                avisos.append(f'Horario del {DIAS[d]}: no se entendió "{s(n)} a {s(n + 1)}".')
            continue
        corte = _rango_horas(s(n + 2))
        if corte and a < corte[0] < corte[1] < z:
            local += [
                {"dia_semana": d, "desde": a, "hasta": corte[0]},
                {"dia_semana": d, "desde": corte[1], "hasta": z},
            ]
        else:
            local.append({"dia_semana": d, "desde": a, "hasta": z})

    # 05 · Servicios (8 filas × 4 desde c79: nombre, precio, duración, quiénes)
    servicios = []
    for i in range(8):
        n = 79 + i * 4
        if not s(n):
            continue
        dur = _numero(s(n + 2)) or 30
        dur = max(5, min(480, dur - dur % 5))
        precio = _numero(s(n + 1))
        if precio is None:
            avisos.append(f'Servicio "{s(n)}": falta el precio.')
        servicios.append(
            {"nombre": s(n), "precio": precio or 0, "duracion_min": dur, "quienes": s(n + 3)}
        )

    # 04 · Barberos (6 filas × 4 desde c55: nombre, días y horario, servicios, mail)
    barberos = []
    nombres_serv = [x["nombre"] for x in servicios]
    for i in range(6):
        n = 55 + i * 4
        if not s(n):
            continue
        horarios = tramos_de_texto(s(n + 1)) if s(n + 1) else []
        if not horarios:
            horarios = list(local)
            if s(n + 1):
                avisos.append(
                    f'{s(n)}: no se entendió el horario "{s(n + 1)}"; '
                    "le puse el del local. Revisalo."
                )
        hace = _nombres(s(n + 2), nombres_serv)
        mail = s(n + 3) if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", s(n + 3)) else ""
        if s(n + 3) and not mail:
            avisos.append(f'{s(n)}: el mail "{s(n + 3)}" no parece válido.')
        barberos.append(
            {
                "nombre": s(n),
                "horario_texto": s(n + 1),
                "horarios": horarios,
                "servicios": hace,
                "email": mail,
            }
        )

    # Qué servicios hace cada barbero: lo que dice el barbero, o si no lo que dice el servicio
    nombres_barb = [x["nombre"] for x in barberos]
    for x in barberos:
        if x["servicios"] is None:
            x["servicios"] = [
                sv["nombre"]
                for sv in servicios
                if (q := _nombres(sv["quienes"], nombres_barb)) is None or x["nombre"] in q
            ]

    # 06 · Tarjeta de cortes
    ruleta = []
    for i in range(6):
        n = 115 + i * 2
        if s(n):
            pct = _numero(s(n + 1))
            ruleta.append(
                {"texto": s(n)[:60], "descuento_pct": min(pct, 100) if pct is not None else 0}
            )
    cada = _numero(s(111))
    modo = "ruleta" if b(113) or (ruleta and not b(112)) else "fijo"
    tarjeta = None
    if cada or ruleta or s(114):
        tarjeta = {
            "cada_x_cortes": max(1, min(20, cada or 5)),
            "modo": modo,
            "ruleta": ruleta,
            "premio": s(114),
        }
        if modo == "ruleta" and len(ruleta) < 2:
            avisos.append("Ruleta: hacen falta al menos 2 premios.")

    return {
        "barberia": barberia,
        "admin": admin,
        "horario_local": local,
        "barberos": barberos,
        "servicios": servicios,
        "tarjeta": tarjeta,
        "ruleta_bienvenida": b(127) and modo == "ruleta",
        "notas": s(129),
        "pendientes": pendientes,
        "avisos": avisos,
    }
