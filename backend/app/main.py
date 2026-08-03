from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
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


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}


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
