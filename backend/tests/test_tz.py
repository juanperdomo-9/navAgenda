from datetime import UTC, datetime

import pytest

from app.core.tz import a_hora_ar, a_utc


def test_hora_argentina_sin_zona_se_guarda_en_utc():
    assert a_utc(datetime(2026, 10, 21, 14, 30)) == datetime(2026, 10, 21, 17, 30, tzinfo=UTC)


def test_utc_se_muestra_en_hora_argentina_y_cambia_de_dia():
    local = a_hora_ar(datetime(2026, 10, 22, 1, 0, tzinfo=UTC))
    assert (local.day, local.hour) == (21, 22)


def test_fecha_sin_zona_no_se_puede_mostrar():
    with pytest.raises(ValueError):
        a_hora_ar(datetime(2026, 10, 21, 14, 30))
