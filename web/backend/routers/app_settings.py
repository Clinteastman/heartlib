"""Settings router for API keys and configuration."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class LLMProvider(BaseModel):
    """LLM provider configuration."""
    id: str
    name: str
    requires_api_key: bool
    models: list[str]
    default_model: str


class LLMSettings(BaseModel):
    """Current LLM settings."""
    provider: str
    model: str
    api_key_set: bool


class UpdateLLMSettingsRequest(BaseModel):
    """Request to update LLM settings."""
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


# Available LLM providers
PROVIDERS = {
    "openai": LLMProvider(
        id="openai",
        name="OpenAI",
        requires_api_key=True,
        models=["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        default_model="gpt-4o",
    ),
    "anthropic": LLMProvider(
        id="anthropic",
        name="Anthropic",
        requires_api_key=True,
        models=["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
        default_model="claude-sonnet-4-20250514",
    ),
    "ollama": LLMProvider(
        id="ollama",
        name="Ollama (Local)",
        requires_api_key=False,
        models=["llama3.2", "llama3.1", "mistral", "mixtral"],
        default_model="llama3.2",
    ),
}

# Runtime settings (in-memory, not persisted)
_runtime_settings = {
    "provider": "openai",
    "model": "gpt-4o",
    "api_keys": {},  # provider -> api_key
}


@router.get("/llm/providers")
async def get_providers():
    """Get available LLM providers."""
    return list(PROVIDERS.values())


@router.get("/llm", response_model=LLMSettings)
async def get_llm_settings():
    """Get current LLM settings."""
    provider = _runtime_settings["provider"]
    api_key = _runtime_settings["api_keys"].get(provider)

    # Also check environment
    if not api_key:
        from ..config import settings
        if provider == "openai" and settings.openai_api_key:
            api_key = settings.openai_api_key

    return LLMSettings(
        provider=provider,
        model=_runtime_settings["model"],
        api_key_set=bool(api_key),
    )


@router.put("/llm")
async def update_llm_settings(request: UpdateLLMSettingsRequest):
    """Update LLM settings."""
    if request.provider:
        if request.provider not in PROVIDERS:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {request.provider}")
        _runtime_settings["provider"] = request.provider

        # Set default model for new provider if model not specified
        if not request.model:
            _runtime_settings["model"] = PROVIDERS[request.provider].default_model

    if request.model:
        provider = request.provider or _runtime_settings["provider"]
        if request.model not in PROVIDERS[provider].models:
            raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")
        _runtime_settings["model"] = request.model

    if request.api_key is not None:
        provider = request.provider or _runtime_settings["provider"]
        _runtime_settings["api_keys"][provider] = request.api_key

        # Update the LLM service with new key
        from ..services.llm_service import llm_service
        llm_service.update_settings(
            provider=provider,
            model=_runtime_settings["model"],
            api_key=request.api_key,
        )

    return {"status": "ok", "message": "Settings updated"}


@router.delete("/llm/api-key/{provider}")
async def delete_api_key(provider: str):
    """Delete API key for a provider."""
    if provider in _runtime_settings["api_keys"]:
        del _runtime_settings["api_keys"][provider]
    return {"status": "ok", "message": f"API key for {provider} deleted"}
