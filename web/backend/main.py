"""FastAPI application for HeartMuLa Web UI."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sys
import asyncio

# Fix for Windows asyncio loop to support subprocesses
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from .config import settings
from .routers import generation, lyrics, models, app_settings

app = FastAPI(
    title="HeartMuLa Web UI",
    description="Web interface for HeartMuLa music generation",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(generation.router, prefix="/api/generation", tags=["generation"])
app.include_router(lyrics.router, prefix="/api/lyrics", tags=["lyrics"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(app_settings.router, prefix="/api/settings", tags=["settings"])

# Serve generated audio files
app.mount("/output", StaticFiles(directory=str(settings.output_dir)), name="output")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    from .services.pipeline_service import pipeline_service
    # Pipeline will be lazily loaded on first request
    print(f"HeartMuLa Web UI starting...")
    print(f"Model path: {settings.model_path}")
    print(f"Model version: {settings.model_version}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
