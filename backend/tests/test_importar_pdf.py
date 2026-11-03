"""Cargar una barbería desde el PDF 'Sumá tu barbería' completado."""

import base64
import io
from pathlib import Path

import pytest
from pypdf import PdfReader, PdfWriter

from app.services import importar_pdf

PDF = Path(__file__).resolve().parents[2] / "docs" / "NavAgenda - Datos para sumar tu barberia.pdf"

LLENO = {
    "c1": "La Tijera",
    "c2": "Tolosa",
    "c3": "Calle 7 e/ 528 y 529",
    "c4": "La Plata",
    "c5": "La Tijera",
    "c6": "221 456 7890",
    "c7": "@la.tijera",
    "c16": "2 horas",
    "c17": "Barbería de barrio.",
    "c24": "Pablo Gómez",
    "c25": "221 555 1234",
    "c26": "pablo",
    # Lunes a viernes 10 a 20 con corte, sábado 9 a 14, domingo cerrado
    "c27": "10",
    "c28": "20",
    "c29": "13 a 14",
    "c31": "10",
    "c32": "20",
    "c35": "10",
    "c36": "20",
    "c39": "10",
    "c40": "20",
    "c43": "10",
    "c44": "20",
    "c47": "9",
    "c48": "14",
    # Barberos
    "c55": "Martín Sosa",
    "c56": "lun a vie 10 a 18, sáb 9 a 14",
    "c57": "todos",
    "c58": "martin@mail.com",
    "c59": "Lucas",
    "c60": "",
    "c61": "Corte",
    "c62": "no-es-mail",
    # Servicios
    "c79": "Corte",
    "c80": "$ 12.000",
    "c81": "30",
    "c82": "todos",
    "c83": "Corte + barba",
    "c84": "15000",
    "c85": "45 min",
    "c86": "Martín",
    # Tarjeta: cada 6, ruleta con 2 premios y bienvenida
    "c111": "6",
    "c115": "Corte gratis",
    "c116": "100",
    "c117": "20% off",
    "c118": "20",
    "c129": "Cerramos del 20 al 27 de diciembre.",
}
TILDES = {"c12": "/Yes", "c18": "/Yes", "c113": "/Yes", "c127": "/Yes", "c54": "/Yes"}


def pdf_completado() -> bytes:
    w = PdfWriter(clone_from=PdfReader(PDF))
    for p in w.pages:
        w.update_page_form_field_values(p, {**LLENO, **TILDES}, auto_regenerate=False)
    out = io.BytesIO()
    w.write(out)
    return out.getvalue()


@pytest.fixture(scope="module")
def propuesta():
    return importar_pdf.leer(pdf_completado())


def test_lee_la_barberia_y_el_duenio(propuesta):
    b = propuesta["barberia"]
    assert (b["nombre"], b["slug"], b["barrio"], b["instagram"]) == (
        "La Tijera",
        "la-tijera",
        "Tolosa",
        "@la.tijera",
    )
    assert b["color_acento"] == "#2f6b4f" and b["horas_min_cancelacion"] == 2  # tildó "Verde"
    assert propuesta["admin"] == {
        "nombre": "Pablo Gómez",
        "whatsapp": "221 555 1234",
        "usuario": "pablo",
    }
    assert any("logo" in p for p in propuesta["pendientes"])


def test_horario_del_local_con_corte_y_dia_cerrado(propuesta):
    lunes = [(t["desde"], t["hasta"]) for t in propuesta["horario_local"] if t["dia_semana"] == 0]
    assert lunes == [("10:00", "13:00"), ("14:00", "20:00")]
    assert not [t for t in propuesta["horario_local"] if t["dia_semana"] == 6]


def test_barberos_con_su_horario_servicios_y_mail(propuesta):
    martin, lucas = propuesta["barberos"]
    sab = [(t["desde"], t["hasta"]) for t in martin["horarios"] if t["dia_semana"] == 5]
    assert sab == [("09:00", "14:00")] and martin["email"] == "martin@mail.com"
    assert martin["servicios"] == ["Corte", "Corte + barba"]
    # Lucas sin horario: el del local; solo hace Corte; mail inválido queda vacío con aviso
    assert lucas["horarios"] == propuesta["horario_local"] and lucas["servicios"] == ["Corte"]
    assert lucas["email"] == "" and any("no-es-mail" in a for a in propuesta["avisos"])


def test_servicios_y_tarjeta(propuesta):
    assert propuesta["servicios"][0] == {
        "nombre": "Corte",
        "precio": 12000,
        "duracion_min": 30,
        "quienes": "todos",
    }
    assert propuesta["servicios"][1]["duracion_min"] == 45
    t = propuesta["tarjeta"]
    assert t["cada_x_cortes"] == 6 and t["modo"] == "ruleta" and len(t["ruleta"]) == 2
    assert propuesta["ruleta_bienvenida"] is True and "diciembre" in propuesta["notas"]


def test_otro_pdf_no_sirve():
    w = PdfWriter()
    w.add_blank_page(100, 100)
    out = io.BytesIO()
    w.write(out)
    with pytest.raises(ValueError):
        importar_pdf.leer(out.getvalue())


def test_alta_completa_desde_el_pdf(client, db, propuesta):
    """Del PDF a la barbería cargada: servicios, barberos con lo que hacen y la ruleta."""
    from sqlalchemy import select

    from app.models import Barberia, Barbero, ReglaBeneficio
    from tests.util import crear_usuario, ingresar

    crear_usuario(db, "juan", rol="superadmin")
    ingresar(client, "juan")
    leido = client.post(
        "/super/importar-pdf", json={"pdf": base64.b64encode(pdf_completado()).decode()}
    )
    assert leido.status_code == 200 and leido.json()["barberia"]["slug"] == "la-tijera"
    p = leido.json()
    alta = {
        **{k: v for k, v in p["barberia"].items()},
        "admin_nombre": p["admin"]["nombre"],
        "admin_usuario": p["admin"]["usuario"],
        "barberos": [
            {k: x[k] for k in ("nombre", "email", "horarios", "servicios")} for x in p["barberos"]
        ],
        "servicios": [
            {k: s[k] for k in ("nombre", "precio", "duracion_min")} for s in p["servicios"]
        ],
        "tarjeta": p["tarjeta"],
        "ruleta_bienvenida": p["ruleta_bienvenida"],
    }
    alta["barberos"][1]["email"] = None
    r = client.post("/super/barberias/completa", json=alta)
    assert r.status_code == 201, r.text
    b = db.scalar(select(Barberia).where(Barberia.slug == "la-tijera"))
    assert b.ruleta_bienvenida and b.instagram == "la.tijera"
    pagina = client.get("/p/la-tijera").json()
    hace = {x["nombre"]: len(x["servicio_ids"]) for x in pagina["barberos"]}
    assert hace == {"Martín Sosa": 2, "Lucas": 1}
    assert (
        db.scalar(select(Barbero.email).where(Barbero.nombre == "Martín Sosa")) == "martin@mail.com"
    )
    regla = db.scalar(select(ReglaBeneficio).where(ReglaBeneficio.barberia_id == b.id))
    assert regla.modo == "ruleta" and regla.cada_x_cortes == 6
