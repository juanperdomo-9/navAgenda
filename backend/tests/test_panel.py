"""Panel del admin: barberos, horarios, días libres, servicios y configuración.
Incluye los tests obligatorios de aislamiento entre barberías."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.color import acento_valido
from app.models import Barbero, Servicio, Turno
from tests.util import crear_usuario, ingresar

LUNES_10_A_14 = {"dia_semana": 0, "desde": "10:00", "hasta": "14:00"}


@pytest.fixture
def admin(client, db):
    """Admin de la barbería A, logueado, con dos servicios cargados."""
    u = crear_usuario(db, "admin-a")
    db.add_all(
        [
            Servicio(barberia_id=u.barberia_id, nombre="Corte", precio=12000, duracion_min=30),
            Servicio(barberia_id=u.barberia_id, nombre="Barba", precio=7000, duracion_min=20),
        ]
    )
    db.flush()
    ingresar(client, "admin-a")
    return u


@pytest.fixture
def otra(db):
    """Barbería B con un barbero y un servicio (de otro admin)."""
    u = crear_usuario(db, "admin-b")
    barbero = Barbero(barberia_id=u.barberia_id, nombre="Barbero de B")
    servicio = Servicio(barberia_id=u.barberia_id, nombre="Corte B", precio=9000, duracion_min=30)
    db.add_all([barbero, servicio])
    db.flush()
    return {"barbero": barbero, "servicio": servicio}


def crear_barbero(client, **extra):
    return client.post("/panel/barberos", json={"nombre": "Martín Sosa", **extra})


# ——— Barberos ———


def test_crear_barbero_le_asigna_todos_los_servicios_y_sus_horarios(client, admin):
    res = crear_barbero(
        client, horarios=[LUNES_10_A_14, {"dia_semana": 0, "desde": "16:00", "hasta": "20:00"}]
    )
    assert res.status_code == 201
    b = res.json()
    assert len(b["servicio_ids"]) == 2
    assert [(h["dia_semana"], h["desde"]) for h in b["horarios"]] == [
        (0, "10:00:00"),
        (0, "16:00:00"),
    ]


def test_horarios_que_se_pisan_se_rechazan(client, admin):
    res = crear_barbero(
        client, horarios=[LUNES_10_A_14, {"dia_semana": 0, "desde": "13:00", "hasta": "18:00"}]
    )
    assert res.status_code == 422
    assert "se pisan" in str(res.json())


def test_horario_que_termina_antes_de_empezar_se_rechaza(client, admin):
    res = crear_barbero(client, horarios=[{"dia_semana": 2, "desde": "18:00", "hasta": "10:00"}])
    assert res.status_code == 422


def test_horarios_en_multiplos_de_5_minutos(client, admin):
    res = crear_barbero(client, horarios=[{"dia_semana": 2, "desde": "10:07", "hasta": "12:00"}])
    assert res.status_code == 422


def test_reemplazar_horarios(client, admin):
    b = crear_barbero(client, horarios=[LUNES_10_A_14]).json()
    res = client.put(
        f"/panel/barberos/{b['id']}/horarios",
        json={"horarios": [{"dia_semana": 5, "desde": "09:00", "hasta": "13:00"}]},
    )
    assert res.status_code == 200
    assert [h["dia_semana"] for h in res.json()["horarios"]] == [5]


def test_baja_logica_conserva_el_barbero_y_su_historial(client, admin, db):
    b = crear_barbero(client).json()
    servicio = db.scalar(select(Servicio).where(Servicio.barberia_id == admin.barberia_id))
    from app.models import Cliente

    cliente = Cliente(barberia_id=admin.barberia_id, telefono="+5492214567890", nombre="Juan")
    db.add(cliente)
    db.flush()
    inicio = datetime(2026, 10, 1, 13, tzinfo=UTC)
    db.add(
        Turno(
            barberia_id=admin.barberia_id,
            barbero_id=b["id"],
            cliente_id=cliente.id,
            servicio_id=servicio.id,
            inicio=inicio,
            fin=inicio + timedelta(minutes=30),
            precio=12000,
            estado="asistio",
        )
    )
    db.flush()

    assert client.delete(f"/panel/barberos/{b['id']}").status_code == 204
    listado = client.get("/panel/barberos").json()
    assert listado[0]["id"] == b["id"] and listado[0]["activo"] is False
    assert db.scalar(select(Turno).where(Turno.barbero_id == b["id"])) is not None


def test_asignar_solo_algunos_servicios(client, admin, db):
    b = crear_barbero(client).json()
    uno = b["servicio_ids"][0]
    res = client.put(f"/panel/barberos/{b['id']}/servicios", json={"servicio_ids": [uno]})
    assert res.status_code == 200 and res.json()["servicio_ids"] == [uno]


# ——— Días libres ———


def test_bloqueos_de_un_barbero(client, admin):
    b = crear_barbero(client).json()
    manana = datetime.now(UTC) + timedelta(days=1)
    datos = {
        "inicio": manana.isoformat(),
        "fin": (manana + timedelta(days=1)).isoformat(),
        "motivo": "Vacaciones",
    }
    creado = client.post(f"/panel/barberos/{b['id']}/bloqueos", json=datos)
    assert creado.status_code == 201
    assert len(client.get(f"/panel/barberos/{b['id']}/bloqueos").json()) == 1
    assert client.delete(f"/panel/bloqueos/{creado.json()['id']}").status_code == 204
    assert client.get(f"/panel/barberos/{b['id']}/bloqueos").json() == []


def test_bloqueo_al_reves_o_sin_zona_horaria_se_rechaza(client, admin):
    b = crear_barbero(client).json()
    al_reves = {"inicio": "2026-11-02T18:00:00-03:00", "fin": "2026-11-02T10:00:00-03:00"}
    sin_zona = {"inicio": "2026-11-02T10:00:00", "fin": "2026-11-02T18:00:00"}
    assert client.post(f"/panel/barberos/{b['id']}/bloqueos", json=al_reves).status_code == 422
    assert client.post(f"/panel/barberos/{b['id']}/bloqueos", json=sin_zona).status_code == 422


# ——— Servicios ———


def test_crear_servicio_lo_asigna_a_los_barberos_activos(client, admin):
    activo = crear_barbero(client).json()
    baja = client.post("/panel/barberos", json={"nombre": "Ex barbero"}).json()
    client.delete(f"/panel/barberos/{baja['id']}")
    res = client.post(
        "/panel/servicios", json={"nombre": "Color", "precio": 22000, "duracion_min": 60}
    )
    assert res.status_code == 201
    assert res.json()["barbero_ids"] == [activo["id"]]


@pytest.mark.parametrize(
    "datos",
    [
        {"nombre": "Corte", "precio": -1, "duracion_min": 30},
        {"nombre": "Corte", "precio": 1000, "duracion_min": 32},
        {"nombre": "Corte", "precio": 1000, "duracion_min": 0},
        {"nombre": "C", "precio": 1000, "duracion_min": 30},
    ],
)
def test_servicio_invalido_se_rechaza(client, admin, datos):
    assert client.post("/panel/servicios", json=datos).status_code == 422


def test_cambiar_precio_y_dar_de_baja_un_servicio(client, admin):
    s = client.get("/panel/servicios").json()[0]
    assert (
        client.patch(f"/panel/servicios/{s['id']}", json={"precio": 13000}).json()["precio"]
        == 13000
    )
    assert client.delete(f"/panel/servicios/{s['id']}").status_code == 204
    estado = {x["id"]: x["activo"] for x in client.get("/panel/servicios").json()}
    assert estado[s["id"]] is False


# ——— Configuración de la página ———


def test_configurar_la_pagina(client, admin):
    res = client.patch(
        "/panel/barberia",
        json={
            "color_acento": "C47F57",
            "direccion": "Calle 8 e/ 49 y 50",
            "barrio": "Centro",
            "lat": -34.9195,
            "lng": -57.953,
        },
    )
    assert res.status_code == 200
    assert res.json()["color_acento"] == "#c47f57"
    assert res.json()["slug"] == "b-admin-a"  # el link no lo cambia el admin


def test_color_que_no_deja_leer_el_texto_se_rechaza(client, admin):
    res = client.patch("/panel/barberia", json={"color_acento": "#767676"})
    assert res.status_code == 422
    assert "leer" in str(res.json())


def test_ubicacion_necesita_latitud_y_longitud(client, admin):
    assert client.patch("/panel/barberia", json={"lat": -34.9}).status_code == 422


@pytest.mark.parametrize(
    "color,ok",
    [
        ("#c9a46a", True),
        ("#1f3a5f", True),
        ("#f6d13a", True),
        ("#777777", False),
        ("#gg0000", False),
    ],
)
def test_acento_valido(color, ok):
    assert acento_valido(color) is ok


# ——— Aislamiento entre barberías (obligatorio) ———


def test_el_listado_solo_trae_lo_de_mi_barberia(client, admin, otra):
    crear_barbero(client)
    nombres = [b["nombre"] for b in client.get("/panel/barberos").json()]
    servicios = [s["nombre"] for s in client.get("/panel/servicios").json()]
    assert "Barbero de B" not in nombres and "Corte B" not in servicios


def test_no_puedo_ver_ni_tocar_un_barbero_de_otra_barberia(client, admin, otra):
    bid = otra["barbero"].id
    assert client.get(f"/panel/barberos/{bid}").status_code == 404
    assert client.patch(f"/panel/barberos/{bid}", json={"nombre": "Hackeado"}).status_code == 404
    assert client.delete(f"/panel/barberos/{bid}").status_code == 404
    assert client.put(f"/panel/barberos/{bid}/horarios", json={"horarios": []}).status_code == 404
    assert (
        client.post(
            f"/panel/barberos/{bid}/bloqueos",
            json={"inicio": "2026-11-02T10:00:00-03:00", "fin": "2026-11-02T18:00:00-03:00"},
        ).status_code
        == 404
    )
    assert otra["barbero"].nombre == "Barbero de B" and otra["barbero"].activo


def test_no_puedo_tocar_un_servicio_de_otra_barberia(client, admin, otra):
    sid = otra["servicio"].id
    assert client.patch(f"/panel/servicios/{sid}", json={"precio": 1}).status_code == 404
    assert client.delete(f"/panel/servicios/{sid}").status_code == 404
    assert otra["servicio"].precio == 9000


def test_no_puedo_asignar_a_mi_barbero_un_servicio_de_otra_barberia(client, admin, otra):
    b = crear_barbero(client).json()
    res = client.put(
        f"/panel/barberos/{b['id']}/servicios", json={"servicio_ids": [str(otra["servicio"].id)]}
    )
    assert res.status_code == 422


def test_no_puedo_borrar_un_bloqueo_de_otra_barberia(client, admin, otra, db):
    from app.models import Bloqueo

    ajeno = Bloqueo(
        barberia_id=otra["barbero"].barberia_id,
        barbero_id=otra["barbero"].id,
        inicio=datetime(2026, 11, 2, 13, tzinfo=UTC),
        fin=datetime(2026, 11, 2, 21, tzinfo=UTC),
    )
    db.add(ajeno)
    db.flush()
    assert client.delete(f"/panel/bloqueos/{ajeno.id}").status_code == 404


def test_superadmin_y_anonimo_no_usan_el_panel(client, db):
    assert client.get("/panel/barberos").status_code == 401
    crear_usuario(db, "juan", rol="superadmin")
    ingresar(client, "juan")
    assert client.get("/panel/barberos").status_code == 403
