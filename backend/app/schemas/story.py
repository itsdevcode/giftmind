import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

# The 5 canonical memory prompt keys and their questions
GUIDED_MEMORY_PROMPTS = {
    "how_we_met": "How did you first meet this person?",
    "favorite_memory": "What is your favorite memory together?",
    "what_makes_them_special": "What makes this person special to you?",
    "shared_milestone": "What challenge, milestone or experience have you shared?",
    "gift_feeling": "What do you want this person to remember or feel when receiving this gift?",
}

ALLOWED_QUESTION_KEYS = set(GUIDED_MEMORY_PROMPTS.keys())


class MemoryAnswerItem(BaseModel):
    """A single memory answer submission."""

    question_key: Annotated[
        str,
        StringConstraints(min_length=1, max_length=50, strip_whitespace=True),
    ]
    answer: Annotated[
        str,
        StringConstraints(max_length=5000, strip_whitespace=True),
    ]

    @model_validator(mode="after")
    def validate_known_question_key(self) -> "MemoryAnswerItem":
        if self.question_key not in ALLOWED_QUESTION_KEYS:
            raise ValueError(
                f"Invalid question_key '{self.question_key}'. Must be one of: {sorted(ALLOWED_QUESTION_KEYS)}"
            )
        return self


class MemoryAnswerRead(BaseModel):
    """Schema for returning a persisted memory answer."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gift_project_id: uuid.UUID
    question_key: str
    question_prompt: str = ""
    answer: str
    created_at: datetime
    updated_at: datetime


class MemoryAnswersUpdateRequest(BaseModel):
    """Request payload for updating memory interview answers."""

    answers: list[MemoryAnswerItem] = Field(
        ...,
        description="List of question keys and answers to upsert.",
    )


class MemoryAnswersListResponse(BaseModel):
    """Response containing all memory answers for a gift project."""

    gift_project_id: uuid.UUID
    answers: list[MemoryAnswerRead]
    has_sufficient_input: bool = Field(
        ...,
        description="Whether enough meaningful input has been provided to generate a grounded story.",
    )
    guidance_message: str = Field(
        default="",
        description="Helpful message explaining current completion state or what is missing.",
    )


# --- AI Story Schemas ---


class StoryPromptInput(BaseModel):
    """Structured input to build the story generation prompt."""

    recipient_name: str
    relationship: str
    occasion: str
    memories: dict[str, str]  # question_key -> answer text


class RawStoryOutput(BaseModel):
    """Structured output expected from LLM story generation."""

    title: Annotated[
        str,
        StringConstraints(min_length=2, max_length=255, strip_whitespace=True),
    ]
    dedication: Annotated[
        str,
        StringConstraints(min_length=5, max_length=1000, strip_whitespace=True),
    ]
    story_body: Annotated[
        str,
        StringConstraints(min_length=200, max_length=10000, strip_whitespace=True),
    ]
    closing_message: Annotated[
        str,
        StringConstraints(min_length=5, max_length=1000, strip_whitespace=True),
    ]

    @model_validator(mode="after")
    def validate_story_word_count(self) -> "RawStoryOutput":
        words = len(self.story_body.split())
        # Soft validation / warning if out of ~350-550 range, but enforce minimum substance
        if words < 100:
            raise ValueError(
                f"Generated story body is too short ({words} words). A heartfelt story requires substantive depth."
            )
        return self


class StoryKeepsakeRead(BaseModel):
    """Public read schema for a persisted Story Keepsake."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gift_project_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    dedication: str
    story_body: str
    closing_message: str
    model_name: str
    prompt_version: str
    status: str
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class StoryKeepsakeUpdateRequest(BaseModel):
    """Request payload for user-controlled story editing."""

    title: Annotated[
        str,
        StringConstraints(min_length=1, max_length=255, strip_whitespace=True),
    ]
    dedication: Annotated[
        str,
        StringConstraints(min_length=1, max_length=2000, strip_whitespace=True),
    ]
    story_body: Annotated[
        str,
        StringConstraints(min_length=20, max_length=20000, strip_whitespace=True),
    ]
    closing_message: Annotated[
        str,
        StringConstraints(min_length=1, max_length=2000, strip_whitespace=True),
    ]
