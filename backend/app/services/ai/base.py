from abc import ABC, abstractmethod

from app.schemas.recommendation import RawGiftRecommendationOutput
from app.schemas.story import RawStoryOutput, StoryPromptInput
from app.services.ai.prompts import RecommendationPromptInput


class AIProvider(ABC):
    """Abstract base class interface for AI model inference providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifier of the AI inference provider (e.g. 'ollama', 'mock')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Identifier of the AI model being invoked."""
        pass

    @abstractmethod
    async def generate_gift_recommendations(
        self,
        prompt_input: RecommendationPromptInput,
    ) -> RawGiftRecommendationOutput:
        """Invoke the LLM to generate exactly 3 validated personalized gift recommendations."""
        pass

    @abstractmethod
    async def generate_story_keepsake(
        self,
        prompt_input: StoryPromptInput,
    ) -> RawStoryOutput:
        """Invoke the LLM to generate a personalized biographical story keepsake.

        Raises:
            AIProviderUnavailableError: When connection to the inference backend fails.
            AIInferenceTimeoutError: When generation takes longer than configured timeout.
            AIModelNotFoundError: When the specified model is missing on the inference host.
            AIResponseValidationError: When model output is malformed or invalid against schema.
        """
        pass

    @abstractmethod
    async def verify_connection(self) -> dict[str, str | bool]:
        """Verify provider availability and model status for smoke tests or health monitoring."""
        pass
