from fastapi import APIRouter

router = APIRouter(tags=["salud"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
