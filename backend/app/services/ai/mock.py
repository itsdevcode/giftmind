from decimal import Decimal

from app.schemas.recommendation import RawGiftIdea, RawGiftRecommendationOutput
from app.schemas.story import RawStoryOutput, StoryPromptInput
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

    async def generate_story_keepsake(
        self,
        prompt_input: StoryPromptInput,
    ) -> RawStoryOutput:
        name = prompt_input.recipient_name
        rel = prompt_input.relationship
        occ = prompt_input.occasion

        # Extract memories for story weaving
        first_met = prompt_input.memories.get(
            "how_we_met", "the day our paths first crossed in quiet serendipity"
        )
        favorite = prompt_input.memories.get(
            "favorite_memory", "the afternoon we lost track of time talking about our biggest hopes"
        )
        special = prompt_input.memories.get(
            "what_makes_them_special", "a genuine warmth and kindness that lights up every room"
        )
        milestone = prompt_input.memories.get(
            "shared_milestone",
            "the challenge we weathered side by side without letting go of optimism",
        )
        feeling = prompt_input.memories.get(
            "gift_feeling", "cherished, deeply appreciated, and reminded that our bond is enduring"
        )

        title = f"The Golden Thread of Moments: A Tribute to {name}"
        dedication = f"Dedicated to {name}, my cherished {rel}, on this special {occ}."

        story_body = (
            f"Some connections in this life take root slowly, like perennials waiting for gentle spring rain, "
            f"while others ignite instantly with a luminous spark. Looking back, {first_met}. From that singular "
            f"beginning, a quiet understanding began to take shape between us, growing richer with each passing season.\n\n"
            f"Life has a way of sweeping us through busy days, but certain memories remain untarnished by the passage "
            f"of time. Among the fondest of them all is {favorite}. In that memory, everything that makes you who you "
            f"are comes into vivid focus: {special}. It is that rare authenticity, that effortless grace you bring into "
            f"the lives of everyone around you, that makes you so deeply special to me.\n\n"
            f"True companionship is tested not when the waters are calm, but when waves test our footing. Together, we "
            f"walked through {milestone}. Standing beside you through that chapter revealed the quiet strength of your "
            f"character and cemented a foundation of trust that cannot be shaken.\n\n"
            f"As we celebrate this {occ}, I find myself reflecting on how grateful I am to share this journey with you. "
            f"May these words serve as an enduring reminder of how much you are cherished, honoring the memories we have "
            f"built together and looking forward with joy to every chapter still unwritten."
        )

        closing_message = (
            f"Happy {occ}, {name}. May you always feel {feeling}. With all my heart and gratitude."
        )

        return RawStoryOutput(
            title=title,
            dedication=dedication,
            story_body=story_body,
            closing_message=closing_message,
        )
