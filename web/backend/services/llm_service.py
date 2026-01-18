"""LLM service for AI-powered lyrics generation with multi-provider support."""

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from ..config import settings

LYRICS_SYSTEM_PROMPT = """You are a professional songwriter. Create lyrics for the HeartMuLa music generation system.

## OUTPUT FORMAT
Respond with lyrics using section markers, then tags. Use EXACTLY this format:

[Intro]
(optional intro vocalizations or leave empty)

[Verse]
lyrics lines here...

[Chorus]
hook and memorable lines...

(add more sections as needed)

---TAGS---
tag1,tag2,tag3,tag4

## GOLDEN RULES OF SONGWRITING

### Structure
- Standard: Intro - Verse - Prechorus - Chorus - Verse - Chorus - Bridge - Chorus - Outro
- [Intro]: Sets mood, can be empty or have vocalizations like "oh", "ah"
- [Verse]: Tells story, builds context, lower energy
- [Prechorus]: Builds tension before chorus
- [Chorus]: Emotional peak, contains the hook, most memorable
- [Bridge]: New perspective, contrast
- [Outro]: Resolution, can mirror intro

### Rhyme Schemes
- AABB: Couplets (punchy, energetic)
- ABAB: Alternating (flowing, classic)
- ABCB: Ballad form (natural, conversational)
- Use perfect rhymes for hooks, near rhymes for sophistication
- Avoid cliche rhymes (heart/apart, fire/desire, love/above)

### Meter & Singability
- Match syllable counts in parallel lines
- Verse: 6-10 syllables per line, Chorus: 4-8 syllables (punchier)
- Align stressed syllables with strong beats
- End phrases on open vowels (a, e, o) for sustained notes
- Avoid consonant clusters at phrase starts

### Emotional Arc
1. Verse 1: Establish situation/setting
2. Chorus 1: Core emotional truth
3. Verse 2: Deepen story, add complexity
4. Bridge: Revelation, twist, or shift in perspective
5. Final Chorus: Emotional payoff, possibly with variation

### The Hook
- 3-7 syllables, simple universal language
- Repeat 3-4 times minimum throughout song
- Place at beginning or end of chorus
- Should be instantly memorable

### Storytelling
- Show don't tell: "Tears roll down" not "I am sad"
- Use sensory details: sight, sound, touch, smell, taste
- Specific over general: "Coffee shop on 5th" not "that place"
- Use present tense for immediacy
- First/second person (I, you, we) for intimacy

### Tags Guidelines (suggest 4-8 tags)
- Instruments: piano, guitar, synthesizer, strings, drums, bass, violin, saxophone
- Mood: happy, sad, melancholic, uplifting, romantic, peaceful, energetic, dramatic
- Genre: pop, rock, ballad, folk, electronic, jazz, classical, r&b, indie
- Feel: upbeat, slow, mid-tempo, fast, groovy, atmospheric, dreamy
- Vocals: male vocals, female vocals, duet, choir

IMPORTANT:
- Tags must be lowercase, comma-separated, no spaces between tags
- Lyrics should be lowercase
- Each section marker must be on its own line in brackets
- Separate lyrics from tags with ---TAGS--- marker"""


@dataclass
class LyricsGenerationResult:
    """Result of lyrics generation."""
    lyrics: str
    tags: str
    raw_response: str


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def generate(self, system_prompt: str, user_message: str, model: str) -> str:
        """Generate a response from the LLM."""
        pass


class OpenAIProvider(LLMProvider):
    """OpenAI API provider."""

    def __init__(self, api_key: str):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=api_key)

    async def generate(self, system_prompt: str, user_message: str, model: str) -> str:
        response = await self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.8,
            max_tokens=2000,
        )
        return response.choices[0].message.content or ""


class AnthropicProvider(LLMProvider):
    """Anthropic API provider."""

    def __init__(self, api_key: str):
        from anthropic import AsyncAnthropic
        self.client = AsyncAnthropic(api_key=api_key)

    async def generate(self, system_prompt: str, user_message: str, model: str) -> str:
        response = await self.client.messages.create(
            model=model,
            max_tokens=2000,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_message},
            ],
        )
        return response.content[0].text if response.content else ""


class OllamaProvider(LLMProvider):
    """Ollama local provider."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    async def generate(self, system_prompt: str, user_message: str, model: str) -> str:
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "stream": False,
                },
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "")


class LLMService:
    """Service for LLM-powered lyrics generation with multi-provider support."""

    def __init__(self):
        self._provider: Optional[LLMProvider] = None
        self._provider_name: str = "openai"
        self._model: str = "gpt-4o"
        self._api_keys: dict[str, str] = {}

        # Initialize from environment if available
        if settings.openai_api_key:
            self._api_keys["openai"] = settings.openai_api_key

    def update_settings(self, provider: str, model: str, api_key: Optional[str] = None):
        """Update LLM settings."""
        self._provider_name = provider
        self._model = model

        if api_key:
            self._api_keys[provider] = api_key

        # Reset provider to force re-initialization
        self._provider = None

    def _get_provider(self) -> LLMProvider:
        """Get or create the current provider."""
        if self._provider is not None:
            return self._provider

        if self._provider_name == "openai":
            api_key = self._api_keys.get("openai")
            if not api_key:
                raise ValueError("OpenAI API key not configured. Please add your API key in Settings.")
            self._provider = OpenAIProvider(api_key)

        elif self._provider_name == "anthropic":
            api_key = self._api_keys.get("anthropic")
            if not api_key:
                raise ValueError("Anthropic API key not configured. Please add your API key in Settings.")
            self._provider = AnthropicProvider(api_key)

        elif self._provider_name == "ollama":
            self._provider = OllamaProvider()

        else:
            raise ValueError(f"Unknown provider: {self._provider_name}")

        return self._provider

    async def generate_lyrics(
        self,
        prompt: str,
        genre: Optional[str] = None,
        mood: Optional[str] = None,
        theme: Optional[str] = None,
        language: str = "english",
    ) -> LyricsGenerationResult:
        """Generate lyrics based on user prompt and preferences."""

        # Build user message with context
        user_parts = [f"Write song lyrics based on this description: {prompt}"]

        if genre:
            user_parts.append(f"Genre: {genre}")
        if mood:
            user_parts.append(f"Mood: {mood}")
        if theme:
            user_parts.append(f"Theme: {theme}")
        if language and language.lower() != "english":
            user_parts.append(f"Language: {language}")

        user_message = "\n".join(user_parts)

        provider = self._get_provider()
        raw_response = await provider.generate(
            LYRICS_SYSTEM_PROMPT,
            user_message,
            self._model,
        )

        # Parse response
        lyrics, tags = self._parse_response(raw_response)

        return LyricsGenerationResult(
            lyrics=lyrics,
            tags=tags,
            raw_response=raw_response,
        )

    def _parse_response(self, response: str) -> tuple[str, str]:
        """Parse LLM response into lyrics and tags."""
        # Split by tags marker
        if "---TAGS---" in response:
            parts = response.split("---TAGS---", 1)
            lyrics = parts[0].strip()
            tags = parts[1].strip() if len(parts) > 1 else ""
        else:
            # Try to find tags at the end
            lines = response.strip().split("\n")
            # Look for a line that looks like tags (comma-separated, no brackets)
            tags_line_idx = None
            for i, line in enumerate(reversed(lines)):
                line = line.strip()
                if line and not line.startswith("[") and "," in line:
                    # Likely tags
                    tags_line_idx = len(lines) - 1 - i
                    break

            if tags_line_idx is not None:
                lyrics = "\n".join(lines[:tags_line_idx]).strip()
                tags = lines[tags_line_idx].strip()
            else:
                lyrics = response.strip()
                tags = "pop,emotional"  # Default tags

        # Clean up tags
        tags = self._clean_tags(tags)

        # Clean up lyrics
        lyrics = self._clean_lyrics(lyrics)

        return lyrics, tags

    def _clean_tags(self, tags: str) -> str:
        """Clean and normalize tags."""
        # Remove any markdown or extra formatting
        tags = tags.strip()
        tags = re.sub(r"[`*_]", "", tags)

        # Split and clean individual tags
        tag_list = [t.strip().lower() for t in tags.split(",")]
        tag_list = [t for t in tag_list if t and len(t) < 30]

        # Remove any tags that look like section markers
        tag_list = [t for t in tag_list if not t.startswith("[")]

        return ",".join(tag_list[:8])  # Limit to 8 tags

    def _clean_lyrics(self, lyrics: str) -> str:
        """Clean and normalize lyrics."""
        # Convert to lowercase
        lyrics = lyrics.lower()

        # Remove any markdown formatting
        lyrics = re.sub(r"```[^`]*```", "", lyrics)
        lyrics = re.sub(r"`[^`]*`", "", lyrics)

        # Ensure section markers are properly formatted
        lyrics = re.sub(r"\[(\w+)\]", lambda m: f"[{m.group(1).capitalize()}]", lyrics, flags=re.IGNORECASE)

        # Clean up extra whitespace while preserving structure
        lines = lyrics.split("\n")
        cleaned_lines = []
        prev_empty = False

        for line in lines:
            line = line.rstrip()
            is_empty = not line.strip()

            # Don't add multiple consecutive empty lines
            if is_empty and prev_empty:
                continue

            cleaned_lines.append(line)
            prev_empty = is_empty

        return "\n".join(cleaned_lines).strip()


# Global singleton
llm_service = LLMService()
