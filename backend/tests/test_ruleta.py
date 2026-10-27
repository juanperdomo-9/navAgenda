"""Ruleta de premios: el cliente gira desde su ticket, misma chance para todos, se usa una vez."""

from collections import Counter

from sqlalchemy import select

from app.models import Fidelidad, Giro
from app.services import premios
from tests.test_agenda import MANANA, ins, manual  # noqa: F401

RULETA = {
    "cada_x_cortes": 2,
    "modo": "ruleta",
    "ruleta": [
        {"texto": "Corte gratis", "descuento_pct": 100},
        {"texto": "50% off", "descuento_pct": 50},
        {"texto": "Cera de regalo", "descuento_pct": 0},
    ],
    "tipo": "texto",
    "descripcion": "Cada 2 cortes, girás la ruleta",
}


def _completar_tarjeta(client, ins):  # noqa: F811
    client.put("/panel/fidelidad", json=RULETA)
    ids = [manual(client, ins, h).json()["id"] for h in (12, 13, 14)]
    for i in ids[:2]:
        client.post(f"/panel/turnos/{i}/asistio", json={})
    return ids[2]


def test_la_ruleta_necesita_dos_premios(client, ins):  # noqa: F811
    r = client.put("/panel/fidelidad", json={**RULETA, "ruleta": RULETA["ruleta"][:1]})
    assert r.status_code == 422


def test_gira_una_vez_y_el_premio_se_aplica_en_el_turno(client, ins, db):  # noqa: F811
    tercero = _completar_tarjeta(client, ins)
    assert db.scalar(select(Giro)) is None  # todavía no giró
    # El panel avisa que tiene premio sin girar
    ag = client.get("/panel/agenda", params={"fecha": str(MANANA)}).json()["turnos"]
    assert ag[2]["tiene_premio"] and ag[2]["premio"] == "Ruleta sin girar"
    # El cliente gira desde su ticket (el token del turno web; acá lo simulamos con el servicio)
    fid = db.scalar(select(Fidelidad))
    assert premios.puede_girar(db, _regla(db), fid)
    g, i = premios.girar(db, _regla(db), fid)
    assert RULETA["ruleta"][i]["texto"] == g.premio
    assert not premios.puede_girar(db, _regla(db), fid)  # una sola vez por premio
    db.flush()
    r = client.post(f"/panel/turnos/{tercero}/asistio", json={"aplicar_premio": True}).json()
    esperado = round(20000 * (100 - g.descuento_pct) / 100)
    assert r["beneficio_aplicado"] and r["cobrado"] == esperado
    # Corregir devuelve el premio (y el mismo giro) sin volver a girar
    client.post(f"/panel/turnos/{tercero}/corregir")
    assert premios.premio_pendiente(db, _regla(db), fid) == g.premio


def test_el_cliente_gira_desde_su_ticket(client, ins, db):  # noqa: F811
    from app.api.routers.publico import _hash
    from app.models import Turno

    tercero = _completar_tarjeta(client, ins)
    db.get(Turno, tercero).token_acceso_hash = _hash("token-de-prueba")
    db.flush()
    tk = client.get("/t/token-de-prueba").json()["fidelidad"]
    assert tk["modo"] == "ruleta" and tk["puede_girar"] and len(tk["ruleta"]) == 3
    r = client.post("/t/token-de-prueba/girar").json()
    assert tk["ruleta"][r["indice"]] == r["premio"] == r["ticket"]["fidelidad"]["premio"]
    assert client.post("/t/token-de-prueba/girar").status_code == 409  # una sola vez


def test_si_no_giro_se_gira_al_aplicar(client, ins):  # noqa: F811
    tercero = _completar_tarjeta(client, ins)
    r = client.post(f"/panel/turnos/{tercero}/asistio", json={"aplicar_premio": True}).json()
    assert r["beneficio_aplicado"] and r["cobrado"] in (0, 10000, 20000)


def test_misma_chance_para_todos():
    class R:
        modo = "ruleta"
        ruleta = RULETA["ruleta"]

    class F:
        barberia_id = cliente_id = None

    class DB:
        def add(self, _):
            pass

        def flush(self):
            pass

    veces = Counter(premios.girar(DB(), R(), F())[1] for _ in range(3000))
    assert set(veces) == {0, 1, 2} and all(800 < v < 1200 for v in veces.values())


def _regla(db):
    from app.models import ReglaBeneficio

    return db.scalar(select(ReglaBeneficio).where(ReglaBeneficio.activa).limit(1))
