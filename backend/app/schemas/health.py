from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str = Field(default="ok", json_schema_extra={"example": "ok"})
    service: str = Field(default="giftmind-api", json_schema_extra={"example": "giftmind-api"})
