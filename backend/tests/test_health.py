from fastapi.testclient import TestClient

from app.main import app


def test_health_responde_ok():
    res = TestClient(app).get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_monitores_pueden_revisar_con_head():
    """UptimeRobot usa HEAD: la salud y las páginas tienen que responder, no 405."""
    assert TestClient(app).head("/health").status_code == 200
    from app.api.routers import paginas

    assert all("HEAD" in r.methods for r in paginas.router.routes)
