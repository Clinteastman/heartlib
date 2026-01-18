"""Configuration for the HeartMuLa Web UI backend."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Model paths
    model_path: Path = Path("./ckpt")
    model_version: str = "3B"

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS settings
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # LLM settings
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Generation settings
    output_dir: Path = Path("./web/output")
    max_concurrent_jobs: int = 1  # GPU memory constraint

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure output directory exists
settings.output_dir.mkdir(parents=True, exist_ok=True)
