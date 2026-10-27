"""Clientes y Números del panel (facturación solo con "asistió" y aislamiento)."""

from tests.test_agenda import MANANA, ins, manual  # noqa: F401
from tests.util import crear_usuario, ingresar


def test_numeros_solo_cuenta_asistio(client, ins):  # noqa: F811
    a, b, _c = (manual(client, ins, h).json()["id"] for h in (12, 13, 14))
    client.post(f"/panel/turnos/{a}/asistio", json={})
    client.post(f"/panel/turnos/{b}/no-asistio")
    n = client.get("/panel/numeros", params={"desde": str(MANANA), "hasta": str(MANANA)}).json()
    assert (n["facturado"], n["cortes"], n["ausencias"]) == (20000, 1, 1)
    assert n["servicios"] == [{"nombre": "Peinado y corte VIP", "veces": 1}]
    thiago = next(x for x in n["por_barbero"] if x["nombre"] == "Thiago")
    assert thiago["facturado"] == 20000
    assert n["por_periodo"] == [{"clave": str(MANANA), "facturado": 20000}]
    # Sin "desde": desde el primer turno (todo el historial); más de 2 meses se agrupa por mes
    todo = client.get("/panel/numeros", params={"hasta": str(MANANA)}).json()
    assert todo["facturado"] == 20000 and todo["desde"] == str(MANANA)
    largo = client.get(
        "/panel/numeros", params={"desde": "2026-01-01", "hasta": str(MANANA)}
    ).json()
    assert largo["agrupado"] == "mes" and largo["por_periodo"][0]["clave"] == "2026-01"


def test_rango_invalido(client, ins):  # noqa: F811
    r = client.get("/panel/numeros", params={"desde": "2026-10-10", "hasta": "2026-10-01"})
    assert r.status_code == 422


def test_clientes_cuenta_visitas_y_bloqueo(client, ins):  # noqa: F811
    a = manual(client, ins, 12).json()["id"]
    manual(client, ins, 13, tel="221 111 2222")
    client.post(f"/panel/turnos/{a}/asistio", json={})
    ls = client.get("/panel/clientes").json()
    assert len(ls) == 2 and ls[0]["telefono"] == "+5492214567890"
    assert (ls[0]["visitas"], ls[0]["cortes"]) == (1, 1)
    r = client.patch(f"/panel/clientes/{ls[0]['id']}", json={"bloqueado": True})
    assert r.json()["bloqueado"] is True


def test_aislamiento_clientes_y_numeros(client, ins, db):  # noqa: F811
    t = manual(client, ins, 12).json()["id"]
    client.post(f"/panel/turnos/{t}/asistio", json={})
    cid = client.get("/panel/clientes").json()[0]["id"]
    client.post("/auth/salir")
    crear_usuario(db, "otro-admin")
    ingresar(client, "otro-admin")
    assert client.get("/panel/clientes").json() == []
    assert client.patch(f"/panel/clientes/{cid}", json={"bloqueado": True}).status_code == 404
    n = client.get("/panel/numeros", params={"desde": str(MANANA), "hasta": str(MANANA)}).json()
    assert n["facturado"] == 0
