"""Pipeline service wrapping HeartMuLaGenPipeline with progress callbacks."""

import asyncio
import logging
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Optional
import torch
from tqdm import tqdm

from ..config import settings

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)


class JobStatus(str, Enum):
    QUEUED = "queued"
    LOADING = "loading"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class GenerationJob:
    """Represents a music generation job."""
    job_id: str
    lyrics: str
    tags: str
    temperature: float = 1.0
    topk: int = 50
    cfg_scale: float = 1.5
    max_audio_length_ms: int = 240000

    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    current_frame: int = 0
    total_frames: int = 0
    output_path: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ProgressTqdm(tqdm):
    """Custom tqdm that reports progress via callback."""

    def __init__(self, *args, progress_callback: Optional[Callable[[int, int], None]] = None, **kwargs):
        self.progress_callback = progress_callback
        super().__init__(*args, **kwargs)

    def update(self, n=1):
        super().update(n)
        if self.progress_callback:
            self.progress_callback(self.n, self.total)


class PipelineService:
    """Service for managing HeartMuLa pipeline and generation jobs."""

    def __init__(self):
        self._pipeline = None
        self._device = None
        self._dtype = None
        self._lock = threading.Lock()
        self._jobs: dict[str, GenerationJob] = {}
        self._current_job: Optional[str] = None
        self._progress_callbacks: dict[str, list[Callable[[GenerationJob], None]]] = {}

    @property
    def is_loaded(self) -> bool:
        return self._pipeline is not None

    def load_pipeline(self):
        """Load the pipeline (thread-safe, idempotent)."""
        with self._lock:
            if self._pipeline is not None:
                logger.info("Pipeline already loaded, skipping...")
                return

            logger.info("="*50)
            logger.info("Starting HeartMuLa pipeline load...")
            logger.info("="*50)
            
            try:
                from heartlib.pipelines.music_generation import HeartMuLaGenPipeline

                self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                self._dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
                
                logger.info(f"Device: {self._device}")
                logger.info(f"Dtype: {self._dtype}")
                logger.info(f"CUDA available: {torch.cuda.is_available()}")
                if torch.cuda.is_available():
                    logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
                    logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
                logger.info(f"Model path: {settings.model_path}")
                logger.info(f"Model version: {settings.model_version}")
                logger.info("Loading model weights... (this may take a while)")

                self._pipeline = HeartMuLaGenPipeline.from_pretrained(
                    pretrained_path=str(settings.model_path),
                    device=self._device,
                    dtype=self._dtype,
                    version=settings.model_version,
                )
                
                logger.info("✓ Pipeline loaded successfully!")
                logger.info("="*50)
            except Exception as e:
                logger.error(f"Failed to load pipeline: {e}")
                logger.exception("Full traceback:")
                raise

    def create_job(
        self,
        lyrics: str,
        tags: str,
        temperature: float = 1.0,
        topk: int = 50,
        cfg_scale: float = 1.5,
        max_audio_length_ms: int = 240000,
    ) -> GenerationJob:
        """Create a new generation job."""
        job_id = str(uuid.uuid4())
        job = GenerationJob(
            job_id=job_id,
            lyrics=lyrics,
            tags=tags,
            temperature=temperature,
            topk=topk,
            cfg_scale=cfg_scale,
            max_audio_length_ms=max_audio_length_ms,
        )
        self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[GenerationJob]:
        """Get a job by ID."""
        return self._jobs.get(job_id)

    def register_progress_callback(self, job_id: str, callback: Callable[[GenerationJob], None]):
        """Register a callback to be called on progress updates."""
        if job_id not in self._progress_callbacks:
            self._progress_callbacks[job_id] = []
        self._progress_callbacks[job_id].append(callback)

    def unregister_progress_callbacks(self, job_id: str):
        """Remove all callbacks for a job."""
        self._progress_callbacks.pop(job_id, None)

    def _notify_progress(self, job_id: str):
        """Notify all registered callbacks of progress update."""
        job = self._jobs.get(job_id)
        if job and job_id in self._progress_callbacks:
            for callback in self._progress_callbacks[job_id]:
                try:
                    callback(job)
                except Exception:
                    pass

    def _generate_with_progress(self, job: GenerationJob):
        """Run generation with progress tracking (internal, runs in thread)."""
        import torchaudio

        logger.info(f"\n{'='*50}")
        logger.info(f"Starting generation job: {job.job_id[:8]}...")
        logger.info(f"{'='*50}")
        logger.info(f"Tags: {job.tags}")
        logger.info(f"Lyrics preview: {job.lyrics[:100]}..." if len(job.lyrics) > 100 else f"Lyrics: {job.lyrics}")
        logger.info(f"Temperature: {job.temperature}, TopK: {job.topk}, CFG: {job.cfg_scale}")
        logger.info(f"Max audio length: {job.max_audio_length_ms/1000:.1f}s")
        
        job.status = JobStatus.LOADING
        job.started_at = datetime.now()
        self._notify_progress(job.job_id)

        logger.info("\nStatus: Loading models...")
        # Ensure pipeline is loaded
        self.load_pipeline()

        job.status = JobStatus.GENERATING
        self._notify_progress(job.job_id)
        logger.info("Status: Generating audio...")

        try:
            # Prepare inputs
            inputs = {"lyrics": job.lyrics, "tags": job.tags}

            # Run preprocessing
            preprocess_kwargs, forward_kwargs, postprocess_kwargs = self._pipeline._sanitize_parameters(
                cfg_scale=job.cfg_scale,
                max_audio_length_ms=job.max_audio_length_ms,
                temperature=job.temperature,
                topk=job.topk,
            )
            model_inputs = self._pipeline.preprocess(inputs, **preprocess_kwargs)

            # Calculate total frames
            max_audio_frames = job.max_audio_length_ms // 80
            job.total_frames = max_audio_frames
            logger.info(f"Total frames to generate: {max_audio_frames}")

            # Run forward pass with progress tracking
            wav = self._forward_with_progress(job, model_inputs, forward_kwargs)

            # Save output
            output_filename = f"{job.job_id}.mp3"
            output_path = settings.output_dir / output_filename
            logger.info(f"\nSaving audio to: {output_path}")
            torchaudio.save(str(output_path), wav, 48000)

            job.output_path = f"/output/{output_filename}"
            job.status = JobStatus.COMPLETED
            logger.info(f"\n{'='*50}")
            logger.info(f"✓ Generation complete!")
            logger.info(f"Output: {job.output_path}")
            logger.info(f"{'='*50}\n")
            job.progress = 1.0
            job.completed_at = datetime.now()

        except Exception as e:
            job.status = JobStatus.FAILED
            job.error = str(e)
            job.completed_at = datetime.now()
            logger.error(f"\n{'='*50}")
            logger.error(f"✗ Generation failed!")
            logger.error(f"Error: {e}")
            logger.error(f"{'='*50}\n")

        self._notify_progress(job.job_id)
        self._current_job = None

    def _forward_with_progress(
        self,
        job: GenerationJob,
        model_inputs: dict[str, Any],
        forward_kwargs: dict[str, Any],
    ) -> torch.Tensor:
        """Modified forward pass with progress tracking."""
        
        def to_device(x):
            """Move tensor to device, handling None and non-tensor types."""
            if x is None:
                return None
            if isinstance(x, torch.Tensor):
                return x.to(self._device)
            return x  # Leave lists and other types as-is
        
        # Ensure all inputs are on the correct device
        prompt_tokens = to_device(model_inputs["tokens"])
        prompt_tokens_mask = to_device(model_inputs["tokens_mask"])
        continuous_segment = to_device(model_inputs["muq_embed"])
        starts = to_device(model_inputs["muq_idx"])
        prompt_pos = to_device(model_inputs["pos"])

        cfg_scale = forward_kwargs["cfg_scale"]
        temperature = forward_kwargs["temperature"]
        topk = forward_kwargs["topk"]
        max_audio_length_ms = forward_kwargs["max_audio_length_ms"]

        frames = []
        bs_size = 2 if cfg_scale != 1.0 else 1

        self._pipeline.model.setup_caches(bs_size)

        with torch.autocast(device_type=self._device.type, dtype=self._dtype):
            curr_token = self._pipeline.model.generate_frame(
                tokens=prompt_tokens,
                tokens_mask=prompt_tokens_mask,
                input_pos=prompt_pos,
                temperature=temperature,
                topk=topk,
                cfg_scale=cfg_scale,
                continuous_segments=continuous_segment,
                starts=starts,
            )
        frames.append(curr_token[0:1,])

        empty_id = self._pipeline.config.empty_id
        audio_eos_id = self._pipeline.config.audio_eos_id
        parallel_number = self._pipeline._parallel_number
        device = self._device  # Capture device reference

        def _pad_audio_token(token: torch.Tensor):
            # Create tensor on same device as token, then fill with empty_id
            padded_token = torch.empty(
                (token.shape[0], parallel_number),
                device=device,
                dtype=torch.long,
            )
            padded_token.fill_(empty_id)
            padded_token[:, :-1] = token
            padded_token = padded_token.unsqueeze(1)
            padded_token_mask = torch.ones_like(
                padded_token, device=device, dtype=torch.bool
            )
            padded_token_mask[..., -1] = False
            return padded_token, padded_token_mask

        max_audio_frames = max_audio_length_ms // 80

        for i in range(max_audio_frames):
            curr_token, curr_token_mask = _pad_audio_token(curr_token)
            with torch.autocast(device_type=self._device.type, dtype=self._dtype):
                curr_token = self._pipeline.model.generate_frame(
                    tokens=curr_token,
                    tokens_mask=curr_token_mask,
                    input_pos=prompt_pos[..., -1:] + i + 1,
                    temperature=temperature,
                    topk=topk,
                    cfg_scale=cfg_scale,
                    continuous_segments=None,
                    starts=None,
                )

            if torch.any(curr_token[0:1, :] >= audio_eos_id):
                break

            frames.append(curr_token[0:1,])

            # Update progress
            job.current_frame = i + 1
            job.progress = (i + 1) / max_audio_frames
            self._notify_progress(job.job_id)
            
            # Log progress every 100 frames
            if (i + 1) % 100 == 0 or i == 0:
                pct = job.progress * 100
                logger.info(f"  Progress: {i+1}/{max_audio_frames} frames ({pct:.1f}%)")

        frames = torch.stack(frames).permute(1, 2, 0).squeeze(0)
        wav = self._pipeline.audio_codec.detokenize(frames)
        return wav

    async def start_generation(self, job: GenerationJob):
        """Start a generation job in a background thread."""
        if self._current_job is not None:
            raise RuntimeError("A generation is already in progress")

        self._current_job = job.job_id

        # Run generation in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._generate_with_progress, job)


# Global singleton instance
pipeline_service = PipelineService()
