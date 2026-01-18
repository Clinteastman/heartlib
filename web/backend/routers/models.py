"""Models router for checking and downloading HeartMuLa models."""

import asyncio
import os
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..config import settings

router = APIRouter()


class ModelInfo(BaseModel):
    """Information about a model."""
    name: str
    path: str
    exists: bool
    repo: Optional[str] = None


class ModelsStatusResponse(BaseModel):
    """Response with all models status."""
    checkpoint_dir: str
    all_present: bool
    models: list[ModelInfo]


class DownloadStatusResponse(BaseModel):
    """Response for download status."""
    status: str
    message: str


REQUIRED_MODELS = [
    {
        "name": "HeartCodec-oss",
        "subdir": "HeartCodec-oss",
        "repo": "HeartMuLa/HeartCodec-oss",
    },
    {
        "name": "HeartMuLa-oss-3B",
        "subdir": "HeartMuLa-oss-3B",
        "repo": "HeartMuLa/HeartMuLa-oss-3B",
    },
    {
        "name": "tokenizer.json",
        "subdir": "tokenizer.json",
        "repo": "HeartMuLa/HeartMuLaGen",  # Part of HeartMuLaGen repo
        "is_file": True,  # This is a file, not a directory
    },
    {
        "name": "gen_config.json",
        "subdir": "gen_config.json",
        "repo": "HeartMuLa/HeartMuLaGen",  # Part of HeartMuLaGen repo
        "is_file": True,  # This is a file, not a directory
    },
]

# Track download status
_download_status = {
    "is_downloading": False,
    "current_model": None,
    "progress": 0,
    "error": None,
}


def get_model_path(subdir: str) -> Path:
    """Get full path to a model."""
    return settings.model_path / subdir


def check_model_exists(subdir: str) -> bool:
    """Check if a model exists."""
    path = get_model_path(subdir)
    return path.exists()


@router.get("/status", response_model=ModelsStatusResponse)
async def get_models_status():
    """Get status of all required models."""
    models = []
    all_present = True

    for model in REQUIRED_MODELS:
        exists = check_model_exists(model["subdir"])
        if not exists:
            all_present = False

        models.append(ModelInfo(
            name=model["name"],
            path=str(get_model_path(model["subdir"])),
            exists=exists,
            repo=model["repo"],
        ))

    return ModelsStatusResponse(
        checkpoint_dir=str(settings.model_path),
        all_present=all_present,
        models=models,
    )


async def download_model_async(repo: str, local_dir: Path):
    """Download a model from HuggingFace."""
    import subprocess
    import concurrent.futures
    
    def run_download(cmd: list[str]) -> bool:
        """Run download command synchronously."""
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
            )
            return result.returncode == 0
        except FileNotFoundError:
            return False
    
    loop = asyncio.get_event_loop()
    
    # Try huggingface-cli first
    cmd1 = ["huggingface-cli", "download", "--local-dir", str(local_dir), repo]
    with concurrent.futures.ThreadPoolExecutor() as executor:
        success = await loop.run_in_executor(executor, run_download, cmd1)
        if success:
            return True
        
        # Try hf command
        cmd2 = ["hf", "download", "--local-dir", str(local_dir), repo]
        success = await loop.run_in_executor(executor, run_download, cmd2)
        if success:
            return True
    
    return False


async def download_all_models():
    """Background task to download all missing models."""
    global _download_status

    _download_status["is_downloading"] = True
    _download_status["error"] = None

    # Get models that need downloading, deduplicating by repo
    # HeartMuLaGen downloads multiple files to root, so only download once
    models_to_download = []
    downloaded_repos = set()
    
    for model in REQUIRED_MODELS:
        if not model["repo"]:
            continue
        if check_model_exists(model["subdir"]):
            continue
        # Skip if we already added this repo (for HeartMuLaGen which has multiple files)
        if model["repo"] in downloaded_repos:
            continue
            
        downloaded_repos.add(model["repo"])
        models_to_download.append(model)

    total = len(models_to_download)

    for i, model in enumerate(models_to_download):
        _download_status["current_model"] = model["name"]
        _download_status["progress"] = int((i / total) * 100) if total > 0 else 0

        # For files that are part of HeartMuLaGen, download to root ckpt dir
        if model.get("is_file"):
            local_dir = settings.model_path
        else:
            local_dir = get_model_path(model["subdir"])

        success = await download_model_async(model["repo"], local_dir)

        if not success:
            _download_status["error"] = f"Failed to download {model['name']}. Make sure huggingface-cli is installed."
            break

    _download_status["is_downloading"] = False
    _download_status["current_model"] = None
    _download_status["progress"] = 100 if not _download_status["error"] else 0


@router.post("/download", response_model=DownloadStatusResponse)
async def start_download(background_tasks: BackgroundTasks):
    """Start downloading missing models."""
    global _download_status

    if _download_status["is_downloading"]:
        raise HTTPException(status_code=409, detail="Download already in progress")

    # Check if any models need downloading
    missing = [m for m in REQUIRED_MODELS if m["repo"] and not check_model_exists(m["subdir"])]

    if not missing:
        return DownloadStatusResponse(
            status="complete",
            message="All models are already downloaded",
        )

    background_tasks.add_task(download_all_models)

    return DownloadStatusResponse(
        status="started",
        message=f"Downloading {len(missing)} model(s)...",
    )


@router.get("/download/status")
async def get_download_status():
    """Get current download status."""
    return _download_status


@router.get("/download/progress")
async def stream_download_progress():
    """Stream download progress via SSE."""
    import json

    async def event_generator():
        while True:
            yield f"data: {json.dumps(_download_status)}\n\n"

            if not _download_status["is_downloading"]:
                break

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
