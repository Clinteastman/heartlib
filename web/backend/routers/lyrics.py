"""Lyrics router for LLM-powered lyrics generation."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.llm_service import llm_service

router = APIRouter()


class LyricsGenerationRequest(BaseModel):
    """Request body for lyrics generation."""
    prompt: str = Field(..., min_length=3, max_length=1000, description="Description of the song you want")
    genre: Optional[str] = Field(None, max_length=50, description="Preferred genre (e.g., pop, rock, ballad)")
    mood: Optional[str] = Field(None, max_length=50, description="Desired mood (e.g., happy, melancholic, uplifting)")
    theme: Optional[str] = Field(None, max_length=100, description="Theme or subject matter")
    language: str = Field("english", max_length=20, description="Language for the lyrics")


class LyricsGenerationResponse(BaseModel):
    """Response with generated lyrics and tags."""
    lyrics: str
    tags: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response."""
    detail: str
    success: bool = False


@router.post("/generate", response_model=LyricsGenerationResponse)
async def generate_lyrics(request: LyricsGenerationRequest):
    """Generate lyrics using LLM based on user prompt."""
    try:
        result = await llm_service.generate_lyrics(
            prompt=request.prompt,
            genre=request.genre,
            mood=request.mood,
            theme=request.theme,
            language=request.language,
        )

        return LyricsGenerationResponse(
            lyrics=result.lyrics,
            tags=result.tags,
        )

    except ValueError as e:
        # API key not configured
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate lyrics: {str(e)}")


# Preset tag categories for the frontend
TAG_PRESETS = {
    "instruments": [
        "piano", "guitar", "acoustic guitar", "electric guitar", "synthesizer",
        "strings", "violin", "cello", "drums", "bass", "saxophone", "trumpet",
        "flute", "harp", "orchestra"
    ],
    "moods": [
        "happy", "sad", "melancholic", "uplifting", "romantic", "peaceful",
        "energetic", "dramatic", "nostalgic", "hopeful", "mysterious",
        "passionate", "calm", "intense", "dreamy"
    ],
    "genres": [
        "pop", "rock", "ballad", "folk", "electronic", "jazz", "classical",
        "r&b", "indie", "country", "soul", "blues", "hip hop", "dance",
        "acoustic", "alternative"
    ],
    "feels": [
        "upbeat", "slow", "mid-tempo", "fast", "groovy", "atmospheric",
        "cinematic", "intimate", "powerful", "gentle", "rhythmic"
    ],
    "vocals": [
        "male vocals", "female vocals", "duet", "choir", "soft vocals",
        "powerful vocals", "emotional vocals"
    ]
}


@router.get("/tag-presets")
async def get_tag_presets():
    """Get preset tag categories for the UI."""
    return TAG_PRESETS


# Example lyrics for testing
EXAMPLE_LYRICS = """[Intro]

[Verse]
walking through the city lights
shadows dance across the night
every corner holds a dream
nothing's ever what it seems

[Prechorus]
i can feel the rhythm start
beating deep inside my heart

[Chorus]
we're alive tonight
chasing stars so bright
let the music take us high
we're alive tonight

[Verse]
memories like photographs
frozen moments, joy and laughs
time keeps moving ever on
but this feeling won't be gone

[Chorus]
we're alive tonight
chasing stars so bright
let the music take us high
we're alive tonight

[Bridge]
when the world feels far away
in this moment we will stay
nothing else can touch us here
just the music, crystal clear

[Chorus]
we're alive tonight
chasing stars so bright
let the music take us high
we're alive tonight

[Outro]
we're alive tonight"""

EXAMPLE_TAGS = "pop,uplifting,synthesizer,energetic,female vocals"


@router.get("/example")
async def get_example():
    """Get example lyrics and tags for testing."""
    return {
        "lyrics": EXAMPLE_LYRICS,
        "tags": EXAMPLE_TAGS,
    }
