"""Auth del panel: ingreso, sesión en cookie, bloqueo por intentos, roles y claves temporales."""

from datetime import UTC, datetime, timedelta

from app.core.security import COOKIE_SESION, MAX_INTENTOS, limite_login
from tests.util import crear_usuario, ingresar

# ——— Ingreso y sesión ———


def test_ingreso_correcto_deja_cookie_httponly_y_devuelve_el_usuario(client, db):
    crear_usuario(db, "navaja")
    res = ingresar(client, "navaja")
    assert res.status_code == 200
    assert res.json()["rol"] == "admin"
    cookie = res.headers["set-cookie"]
    assert COOKIE_SESION in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert "password_hash" not in res.json()


def test_el_usuario_no_distingue_mayusculas(client, db):
    crear_usuario(db, "Navaja")
    assert ingresar(client, "  NAVAJA ").status_code == 200


def test_clave_incorrecta_y_usuario_inexistente_dan_el_mismo_mensaje(client, db):
    crear_usuario(db, "navaja")
    mal = ingresar(client, "navaja", "otra-clave")
    nadie = ingresar(client, "no-existe")
    assert mal.status_code == nadie.status_code == 401
    assert mal.json() == nadie.json() == {"detail": "Usuario o clave incorrectos."}


def test_usuario_dado_de_baja_no_entra(client, db):
    crear_usuario(db, "navaja", activo=False)
    assert ingresar(client, "navaja").status_code == 401


def test_yo_requiere_sesion_y_salir_la_borra(client, db):
    crear_usuario(db, "navaja")
    assert client.get("/auth/yo").status_code == 401
    ingresar(client, "navaja")
    assert client.get("/auth/yo").json()["usuario"] == "navaja"
    client.post("/auth/salir")
    assert client.get("/auth/yo").status_code == 401


def test_cookie_manipulada_no_sirve(client, db):
    crear_usuario(db, "navaja")
    client.cookies.set(COOKIE_SESION, "eyJhbGciOiJIUzI1NiJ9.e30.firma-falsa")
    assert client.get("/auth/yo").status_code == 401


def test_dar_de_baja_corta_la_sesion_abierta(client, db):
    u = crear_usuario(db, "navaja")
    ingresar(client, "navaja")
    u.activo = False
    db.flush()
    assert client.get("/auth/yo").status_code == 401


# ——— Fuerza bruta ———


def test_tras_varios_intentos_fallidos_la_cuenta_se_bloquea(client, db):
    crear_usuario(db, "navaja")
    for _ in range(MAX_INTENTOS):
        assert ingresar(client, "navaja", "mal").status_code == 401
    # Bloqueada: ni siquiera la clave correcta entra
    res = ingresar(client, "navaja")
    assert res.status_code == 423
    assert "bloqueamos" in res.json()["detail"]


def test_el_bloqueo_vence_y_un_ingreso_correcto_reinicia_el_contador(client, db):
    u = crear_usuario(db, "navaja")
    u.bloqueado_hasta = datetime.now(UTC) - timedelta(minutes=1)
    u.intentos_fallidos = MAX_INTENTOS - 1
    db.flush()
    assert ingresar(client, "navaja").status_code == 200
    db.refresh(u)
    assert u.intentos_fallidos == 0 and u.bloqueado_hasta is None


def test_limite_de_intentos_por_ip(client, db):
    for _ in range(limite_login.maximo):
        ingresar(client, "cualquiera", "mal")
    assert ingresar(client, "cualquiera", "mal").status_code == 429


# ——— Roles ———


def test_admin_no_puede_usar_endpoints_de_superadmin(client, db):
    crear_usuario(db, "navaja")
    ingresar(client, "navaja")
    assert client.get("/super/barberias").status_code == 403


def test_superadmin_crea_barberia_con_admin_y_clave_temporal(client, db):
    crear_usuario(db, "juan", rol="superadmin")
    ingresar(client, "juan")
    res = client.post(
        "/super/barberias",
        json={
            "nombre": "Barbería Nueva",
            "slug": "barberia-nueva",
            "barrio": "Tolosa",
            "admin_nombre": "Pablo",
            "admin_usuario": "pablo",
        },
    )
    assert res.status_code == 201
    datos = res.json()
    assert datos["barberia"]["slug"] == "barberia-nueva"
    temporal = datos["clave_temporal"]

    # El dueño entra con la temporal, pero no puede usar el panel hasta cambiarla
    client.post("/auth/salir")
    yo = ingresar(client, "pablo", temporal).json()
    assert yo["debe_cambiar_clave"] is True and yo["rol"] == "admin"
    cambio = client.post(
        "/auth/cambiar-clave", json={"clave_actual": temporal, "clave_nueva": "mi-clave-nueva-123"}
    )
    assert cambio.status_code == 204
    assert client.get("/auth/yo").json()["debe_cambiar_clave"] is False


def test_superadmin_no_puede_usar_un_slug_reservado(client, db):
    crear_usuario(db, "juan", rol="superadmin")
    ingresar(client, "juan")
    res = client.post(
        "/super/barberias",
        json={
            "nombre": "Panel",
            "slug": "panel",
            "admin_nombre": "Xavier",
            "admin_usuario": "xx-admin",
        },
    )
    assert res.status_code == 422
    assert "ruta de NavAgenda" in str(res.json())


def test_superadmin_no_repite_slug_ni_usuario(client, db):
    crear_usuario(db, "juan", rol="superadmin")
    crear_usuario(db, "navaja")  # crea la barbería b-navaja y el usuario navaja
    ingresar(client, "juan")
    base = {"nombre": "Otra", "admin_nombre": "Xavier"}
    assert (
        client.post(
            "/super/barberias", json={**base, "slug": "b-navaja", "admin_usuario": "nuevo"}
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/super/barberias", json={**base, "slug": "otra", "admin_usuario": "NAVAJA"}
        ).status_code
        == 409
    )


def test_superadmin_resetea_la_clave_de_un_admin_bloqueado(client, db):
    crear_usuario(db, "juan", rol="superadmin")
    admin = crear_usuario(db, "navaja", bloqueado_hasta=datetime.now(UTC) + timedelta(minutes=10))
    ingresar(client, "juan")
    res = client.post(f"/super/usuarios/{admin.id}/resetear-clave")
    assert res.status_code == 200
    temporal = res.json()["clave_temporal"]
    client.post("/auth/salir")
    assert ingresar(client, "navaja", temporal).json()["debe_cambiar_clave"] is True
    # Con la clave temporal todavía no puede usar endpoints con rol
    assert client.get("/super/barberias").status_code == 403


def test_cambiar_clave_exige_la_actual(client, db):
    crear_usuario(db, "navaja")
    ingresar(client, "navaja")
    res = client.post(
        "/auth/cambiar-clave", json={"clave_actual": "mal", "clave_nueva": "otra-clave-larga"}
    )
    assert res.status_code == 400


def test_superadmin_lista_con_admins_y_pausa_una_barberia(client, db):
    crear_usuario(db, "juan", rol="superadmin")
    ingresar(client, "juan")
    client.post(
        "/super/barberias",
        json={
            "nombre": "Pausable",
            "slug": "pausable",
            "admin_nombre": "Ana",
            "admin_usuario": "ana",
        },
    )
    b = next(x for x in client.get("/super/barberias").json() if x["slug"] == "pausable")
    assert b["admins"][0]["usuario"] == "ana" and b["barberos"] == 0
    assert client.get("/p/pausable").status_code == 200
    assert (
        client.patch(f"/super/barberias/{b['id']}", json={"activa": False}).json()["activa"]
        is False
    )
    assert client.get("/p/pausable").status_code == 404


def test_arranque_inicial_crea_superadmin_e_inspirationmen_una_sola_vez(db):
    from app.cli import preparar_inicial

    avisos = preparar_inicial(db)
    assert len(avisos) == 2 and "juan" in avisos[0] and "Inspirationmen" in avisos[1]
    assert not any("temporal " in a for a in avisos)  # las claves nunca van a los logs
    assert preparar_inicial(db) == []


def test_clave_temporal_por_hash_y_no_pisa_la_clave_elegida(client, db):
    from app.cli import preparar_inicial
    from app.core.security import hashear_clave

    preparar_inicial(db)
    h = hashear_clave("temporal-de-prueba-1")
    assert preparar_inicial(db, {"juan": h, "nadie": h}) == [
        "Usuario 'juan': clave temporal aplicada",
        "CLAVE_TEMPORAL de 'nadie' ignorada (usuario o hash inválido)",
    ]
    ingresar(client, "juan", "temporal-de-prueba-1")
    client.post(
        "/auth/cambiar-clave",
        json={"clave_actual": "temporal-de-prueba-1", "clave_nueva": "mi-clave-nueva-123"},
    )
    # Ya eligió su clave: la variable que quedó en Render no la vuelve a pisar
    assert preparar_inicial(db, {"juan": h}) == []
