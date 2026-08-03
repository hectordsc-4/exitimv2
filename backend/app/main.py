from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import engine
from app.routers import router

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(_request: Request, exc: SQLAlchemyError):
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Error de base de datos",
            "error": str(exc.__cause__ or exc),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno", "error": f"{type(exc).__name__}: {exc}"},
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/health/db")
def health_db():
    parsed = urlparse(
        settings.database_url.replace("postgresql+psycopg2://", "postgresql://", 1)
    )
    info = {
        "host": parsed.hostname,
        "db": (parsed.path or "").lstrip("/"),
        "user": parsed.username,
    }
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            n = conn.execute(text("SELECT count(*) FROM exi_usuarios")).scalar()
        return {"status": "ok", "database": info, "usuarios": n}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            status_code=500,
            content={"status": "error", "database": info, "error": str(exc)},
        )


if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def index():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/login")
    def login_page():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/home")
    def home_page():
        return FileResponse(FRONTEND_DIR / "home.html")

    @app.get("/admin")
    def admin_page():
        return FileResponse(FRONTEND_DIR / "admin.html")

    @app.get("/general")
    def general_page():
        return FileResponse(FRONTEND_DIR / "general.html")

    @app.get("/asistencia")
    def asistencia_page():
        return FileResponse(FRONTEND_DIR / "asistencia.html")
