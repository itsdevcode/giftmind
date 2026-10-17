from decimal import Decimal

from app.schemas.recommendation import RawGiftIdea, RawGiftRecommendationOutput
from app.services.ai.base import AIProvider
from app.services.ai.prompts import RecommendationPromptInput


class MockAIProvider(AIProvider):
    """Deterministic mock provider for automated unit, integration, and CI testing."""

    def __init__(self, model_name: str = "mock-gemma") -> None:
        self._model = model_name

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return self._model

    async def verify_connection(self) -> dict[str, str | bool]:
        return {
            "provider": "mock",
            "available": True,
            "model": self._model,
            "model_installed": True,
        }

    async def generate_gift_recommendations(
        self,
        prompt_input: RecommendationPromptInput,
    ) -> RawGiftRecommendationOutput:
        # Generate 3 distinct ideas honoring the input data
        target_budget = (prompt_input.budget_min + prompt_input.budget_max) / Decimal("2.0")
        b1 = max(prompt_input.budget_min, target_budget * Decimal("0.8")).quantize(Decimal("0.01"))
        b2 = target_budget.quantize(Decimal("0.01"))
        b3 = min(prompt_input.budget_max, target_budget * Decimal("1.1")).quantize(Decimal("0.01"))

        primary_interest = (
            prompt_input.interests[0] if prompt_input.interests else "personalized memories"
        )
        name = prompt_input.recipient_name

        return RawGiftRecommendationOutput(
            recommendations=[
                RawGiftIdea(
                    title=f"Custom Handcrafted {primary_interest.title()} Keepsake",
                    description=f"A personalized artisan piece celebrating {name}'s deep love for {primary_interest}, engraved with a special note.",
                    category="Keepsake & Art",
                    personalization_reason=f"Specially created for {name} reflecting their enthusiasm for {primary_interest} on {prompt_input.occasion}.",
                    estimated_budget=b1,
                    presentation_idea="Wrap in natural linen paper with a handwritten letter tucked inside.",
                ),
                RawGiftIdea(
                    title=f"Curated {primary_interest.title()} Discovery Workshop Experience",
                    description=f"An interactive masterclass session where {name} and their closest companion can explore new techniques together.",
                    category="Experiential",
                    personalization_reason=f"Combines their relationship as {prompt_input.relationship} with memorable shared quality time.",
                    estimated_budget=b2,
                    presentation_idea="Present inside a vintage sealed envelope with a custom invitation ticket.",
                ),
                RawGiftIdea(
                    title=f"Premium {primary_interest.title()} Enthusiast Companion Set",
                    description=f"A carefully chosen selection of premium tools and goods tailored for daily {primary_interest} enjoyment.",
                    category="Hobby & Practical",
                    personalization_reason=f"Directly supports {name}'s ongoing passions while elevating their everyday routine.",
                    estimated_budget=b3,
                    presentation_idea="Pack inside a reusable wooden keepsake crate tied with raw twine ribbon.",
                ),
            ]
        )
