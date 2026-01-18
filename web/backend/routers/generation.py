"""Generation router with SSE progress updates."""

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..services.pipeline_service import GenerationJob, JobStatus, pipeline_service

router = APIRouter()


class GenerationRequest(BaseModel):
    """Request body for music generation."""
    lyrics: str = Field(..., description="Song lyrics with section markers")
    tags: str = Field(..., description="Comma-separated tags (e.g., 'piano,emotional,ballad')")
    temperature: float = Field(1.0, ge=0.1, le=2.0, description="Generation temperature")
    topk: int = Field(50, ge=1, le=200, description="Top-k sampling")
    cfg_scale: float = Field(1.5, ge=1.0, le=3.0, description="Classifier-free guidance scale")
    max_audio_length_ms: int = Field(240000, ge=60000, le=480000, description="Max audio length in ms")


class GenerationResponse(BaseModel):
    """Response with job info."""
    job_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    """Job status response."""
    job_id: str
    status: str
    progress: float
    current_frame: int
    total_frames: int
    output_path: Optional[str] = None
    error: Optional[str] = None


@router.post("/start", response_model=GenerationResponse)
async def start_generation(request: GenerationRequest, background_tasks: BackgroundTasks):
    """Start a music generation job."""
    # Check if a job is already running
    if pipeline_service._current_job is not None:
        raise HTTPException(
            status_code=429,
            detail="A generation is already in progress. Please wait for it to complete."
        )

    # Create the job
    job = pipeline_service.create_job(
        lyrics=request.lyrics,
        tags=request.tags,
        temperature=request.temperature,
        topk=request.topk,
        cfg_scale=request.cfg_scale,
        max_audio_length_ms=request.max_audio_length_ms,
    )

    # Start generation in background
    background_tasks.add_task(pipeline_service.start_generation, job)

    return GenerationResponse(
        job_id=job.job_id,
        status=job.status.value,
        message="Generation started. Use /progress/{job_id} to track progress."
    )


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get the status of a generation job."""
    job = pipeline_service.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status.value,
        progress=job.progress,
        current_frame=job.current_frame,
        total_frames=job.total_frames,
        output_path=job.output_path,
        error=job.error,
    )


@router.get("/progress/{job_id}")
async def stream_progress(job_id: str):
    """Stream generation progress via Server-Sent Events."""
    job = pipeline_service.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()

        def on_progress(updated_job: GenerationJob):
            # Put update in queue (non-blocking)
            try:
                queue.put_nowait(updated_job)
            except asyncio.QueueFull:
                pass

        # Register callback
        pipeline_service.register_progress_callback(job_id, on_progress)

        try:
            # Send initial state
            yield f"data: {json.dumps(_job_to_dict(job))}\n\n"

            # If already completed/failed, end stream
            if job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                return

            # Stream updates
            while True:
                try:
                    # Wait for update with timeout
                    updated_job = await asyncio.wait_for(queue.get(), timeout=30.0)

                    yield f"data: {json.dumps(_job_to_dict(updated_job))}\n\n"

                    # End stream if job is done
                    if updated_job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                        break

                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f": keepalive\n\n"

                    # Check if job is still valid
                    current_job = pipeline_service.get_job(job_id)
                    if current_job is None:
                        break
                    if current_job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                        yield f"data: {json.dumps(_job_to_dict(current_job))}\n\n"
                        break

        finally:
            pipeline_service.unregister_progress_callbacks(job_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _job_to_dict(job: GenerationJob) -> dict:
    """Convert job to dictionary for JSON serialization."""
    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "progress": job.progress,
        "current_frame": job.current_frame,
        "total_frames": job.total_frames,
        "output_path": job.output_path,
        "error": job.error,
    }


@router.get("/download/{job_id}")
async def get_download_info(job_id: str):
    """Get download information for a completed job."""
    job = pipeline_service.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Job is not completed")

    if job.output_path is None:
        raise HTTPException(status_code=500, detail="Output path not available")

    return {
        "job_id": job.job_id,
        "download_url": job.output_path,
        "filename": f"heartmula_{job.job_id[:8]}.mp3",
    }
