from fastapi import APIRouter

router = APIRouter(tags=["salud"])


@router.api_route("/health", methods=["GET", "HEAD"])  # HEAD: monitores como UptimeRobot
def health() -> dict[str, str]:
    return {"status": "ok"}
