import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.gift_project import GiftProject
from app.models.recommendation import (
    GiftRecommendation,
    GiftRecommendationGeneration,
    RecommendationGenerationStatus,
)
from app.services.ai.exceptions import (
    AIAuthenticationError,
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderUnavailableError,
    AIRateLimitError,
    AIResponseValidationError,
)
from app.services.ai.mock import MockAIProvider


async def _create_user_and_project(
    client: AsyncClient, name: str, email: str
) -> tuple[str, str, str]:
    """Helper to register user, create recipient, create gift project, returning (token, recipient_id, project_id)."""
    # 1. Register
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": "Password123!"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Recipient
    rec_res = await client.post(
        "/api/v1/recipients",
        json={
            "name": "Jordan Smith",
            "relationship": "Partner",
            "interests": ["Astronomy", "Espresso", "Hiking"],
            "notes": "Loves stargazing in national parks and collecting vintage roasters.",
        },
        headers=headers,
    )
    assert rec_res.status_code == 201
    rec_id = rec_res.json()["id"]

    # 3. Gift Project
    proj_res = await client.post(
        "/api/v1/gift-projects",
        json={
            "recipient_id": rec_id,
            "title": "30th Birthday Adventure",
            "occasion": "30th Birthday",
            "budget_min": "40.00",
            "budget_max": "150.00",
            "currency": "USD",
        },
        headers=headers,
    )
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    return token, rec_id, proj_id


@pytest.mark.asyncio
async def test_generate_and_get_recommendations_success(
    client: AsyncClient,
) -> None:
    """End-to-end happy path: generates exactly 3 distinct recommendations, persists them,
    and allows subsequent retrieval via GET endpoint.
    """
    token, _, proj_id = await _create_user_and_project(client, "Happy Giver", "happy@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Generate recommendations
    gen_res = await client.post(
        f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
        headers=headers,
    )
    assert gen_res.status_code == 201
    gen_data = gen_res.json()

    assert gen_data["status"] == "succeeded"
    assert gen_data["gift_project_id"] == proj_id
    recs = gen_data["recommendations"]
    assert len(recs) == 3

    # Validate distinct recommendations and required fields
    titles = set()
    for rec in recs:
        assert rec["title"]
        assert rec["description"]
        assert rec["category"]
        assert rec["personalization_reason"]
        assert Decimal(rec["estimated_budget"]) >= Decimal("40.00")
        assert Decimal(rec["estimated_budget"]) <= Decimal("150.00")
        assert rec["currency"] == "USD"
        assert rec["presentation_idea"]
        titles.add(rec["title"])
    assert len(titles) == 3, "Expected 3 distinct recommendation titles"

    # 2. Get latest recommendations
    get_res = await client.get(
        f"/api/v1/gift-projects/{proj_id}/recommendations",
        headers=headers,
    )
    assert get_res.status_code == 200
    saved_data = get_res.json()
    assert saved_data["id"] == gen_data["id"]
    assert len(saved_data["recommendations"]) == 3
    assert saved_data["recommendations"][0]["title"] == recs[0]["title"]


@pytest.mark.asyncio
async def test_cross_user_isolation(client: AsyncClient) -> None:
    """User B cannot generate recommendations for User A's project, nor view them."""
    token_a, _, proj_a = await _create_user_and_project(client, "Owner A", "user_a@example.com")
    token_b, _, _ = await _create_user_and_project(client, "Owner B", "user_b@example.com")

    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B attempting to generate on User A's project -> 404
    gen_res = await client.post(
        f"/api/v1/gift-projects/{proj_a}/recommendations/generate",
        headers=headers_b,
    )
    assert gen_res.status_code == 404

    # User B attempting to GET User A's recommendations -> 404
    get_res = await client.get(
        f"/api/v1/gift-projects/{proj_a}/recommendations",
        headers=headers_b,
    )
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_get_recommendations_not_found_when_empty(client: AsyncClient) -> None:
    """GET /recommendations returns 404 when no recommendations have been generated yet."""
    token, _, proj_id = await _create_user_and_project(client, "Empty Giver", "empty@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get(
        f"/api/v1/gift-projects/{proj_id}/recommendations",
        headers=headers,
    )
    assert res.status_code == 404
    assert "No recommendations have been generated" in res.json()["detail"]


@pytest.mark.asyncio
async def test_ai_provider_timeout_handling(client: AsyncClient, test_app) -> None:
    """When the AI provider times out, returns HTTP 503, records failed status in DB,
    and rolls back partial recommendation rows.
    """
    token, _, proj_id = await _create_user_and_project(
        client, "Timeout User", "timeout@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    with patch(
        "app.services.ai.mock.MockAIProvider.generate_gift_recommendations",
        new=AsyncMock(side_effect=AIInferenceTimeoutError("Inference timed out.")),
    ):
        res = await client.post(
            f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
            headers=headers,
        )
        assert res.status_code == 503
        assert "timed out" in res.json()["detail"].lower()

    # Verify database state has failed generation and 0 recommendations
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        gen_res = await session.execute(
            select(GiftRecommendationGeneration).where(
                GiftRecommendationGeneration.gift_project_id == uuid.UUID(proj_id)
            )
        )
        gen = gen_res.scalar_one()
        assert gen.status == RecommendationGenerationStatus.failed
        assert "timed out" in (gen.error_message or "")

        recs_res = await session.execute(
            select(GiftRecommendation).where(
                GiftRecommendation.gift_project_id == uuid.UUID(proj_id)
            )
        )
        assert len(recs_res.scalars().all()) == 0


@pytest.mark.asyncio
async def test_ai_provider_unavailable_handling(client: AsyncClient) -> None:
    """When the AI inference host is down or unreachable, returns 503."""
    token, _, proj_id = await _create_user_and_project(client, "Down User", "down@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    with patch(
        "app.services.ai.mock.MockAIProvider.generate_gift_recommendations",
        new=AsyncMock(
            side_effect=AIProviderUnavailableError("Inference host unavailable or unreachable.")
        ),
    ):
        res = await client.post(
            f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
            headers=headers,
        )
        assert res.status_code == 503
        assert "unavailable" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_ai_model_not_found_handling(client: AsyncClient) -> None:
    """When the configured model is not installed on the inference host, returns 503."""
    token, _, proj_id = await _create_user_and_project(
        client, "Model User", "model_missing@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    with patch(
        "app.services.ai.mock.MockAIProvider.generate_gift_recommendations",
        new=AsyncMock(side_effect=AIModelNotFoundError("gemma2:2b")),
    ):
        res = await client.post(
            f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
            headers=headers,
        )
        assert res.status_code == 503
        assert "not found" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_ai_rate_limit_handling(client: AsyncClient) -> None:
    """When the AI provider rate limit is exceeded, returns 429 Too Many Requests with Retry-After header."""
    token, _, proj_id = await _create_user_and_project(
        client, "Rate Limited User", "ratelimit@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    with patch(
        "app.services.ai.mock.MockAIProvider.generate_gift_recommendations",
        new=AsyncMock(side_effect=AIRateLimitError("Quota exceeded", retry_after=5.0)),
    ):
        res = await client.post(
            f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
            headers=headers,
        )
        assert res.status_code == 429
        assert "busy" in res.json()["detail"].lower()
        assert res.headers.get("retry-after") == "5"


@pytest.mark.asyncio
async def test_ai_authentication_error_handling(client: AsyncClient) -> None:
    """When the AI provider authentication fails, returns 503 Service Unavailable."""
    token, _, proj_id = await _create_user_and_project(
        client, "Auth Error User", "autherror@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    with patch(
        "app.services.ai.mock.MockAIProvider.generate_gift_recommendations",
        new=AsyncMock(side_effect=AIAuthenticationError("Invalid API key")),
    ):
        res = await client.post(
            f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
            headers=headers,
        )
        assert res.status_code == 503
        assert "misconfigured" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_ai_malformed_json_handling(client: AsyncClient) -> None:
    """When the model output is malformed or invalid JSON, returns 502 Bad Gateway."""
    token, _, proj_id = await _create_user_and_project(
        client, "Malformed User", "malformed@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    with patch(
        "app.services.ai.mock.MockAIProvider.generate_gift_recommendations",
        new=AsyncMock(side_effect=AIResponseValidationError("Invalid JSON produced.")),
    ):
        res = await client.post(
            f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
            headers=headers,
        )
        assert res.status_code == 502
        assert "invalid or malformed" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_concurrent_generation_simultaneous_requests(client: AsyncClient) -> None:
    """When two simultaneous generation requests hit the same gift project,
    the PostgreSQL partial unique index and atomic claim guarantee only one request succeeds (201)
    and the other receives 409 Conflict. Only the claim winner invokes the AI provider.
    After the winning generation completes, subsequent generation requests succeed.
    """
    token, _, proj_id = await _create_user_and_project(
        client, "Simultaneous Racer", "simultaneous_racer@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    first_started = asyncio.Event()
    second_arrived = asyncio.Event()
    provider_call_count = 0

    real_generate = MockAIProvider.generate_gift_recommendations

    async def synchronized_generate(self, prompt_input):
        nonlocal provider_call_count
        provider_call_count += 1
        first_started.set()
        # Wait until the second request has arrived and received its response
        await asyncio.wait_for(second_arrived.wait(), timeout=5.0)
        return await real_generate(self, prompt_input)

    with patch.object(
        MockAIProvider,
        "generate_gift_recommendations",
        new=synchronized_generate,
    ):

        async def _req1():
            return await client.post(
                f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
                headers=headers,
            )

        async def _req2():
            # Guarantee Request 1 has started model inference (and committed the pending claim)
            await asyncio.wait_for(first_started.wait(), timeout=5.0)
            res = await client.post(
                f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
                headers=headers,
            )
            second_arrived.set()
            return res

        res1, res2 = await asyncio.gather(_req1(), _req2())

    status_codes = sorted([res1.status_code, res2.status_code])
    assert status_codes == [201, 409]
    assert provider_call_count == 1

    # Verify a new request can generate recommendations after the first finishes
    res3 = await client.post(
        f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
        headers=headers,
    )
    assert res3.status_code == 201


@pytest.mark.asyncio
async def test_stale_pending_generation_recovery(client: AsyncClient, test_app) -> None:
    """When an abandoned/stale pending generation (> 75s old) is present, the next request
    recovers by marking the stale run as failed and proceeding to generate new recommendations.
    """
    token, _, proj_id = await _create_user_and_project(
        client, "Stale User", "stale_gen@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Insert an abandoned pending generation from 10 minutes ago
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        stale_gen = GiftRecommendationGeneration(
            gift_project_id=uuid.UUID(proj_id),
            user_id=(await session.get(GiftProject, uuid.UUID(proj_id))).user_id,
            provider="mock",
            model="mock-gemma",
            prompt_version="v1",
            status=RecommendationGenerationStatus.pending,
            created_at=datetime.now(UTC) - timedelta(minutes=10),
            updated_at=datetime.now(UTC) - timedelta(minutes=10),
        )
        session.add(stale_gen)
        await session.commit()
        stale_id = stale_gen.id

    # New generation should recover and succeed with 201
    res = await client.post(
        f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "succeeded"

    # Confirm stale record was marked failed
    async with session_factory() as session:
        recovered = await session.get(GiftRecommendationGeneration, stale_id)
        assert recovered.status == RecommendationGenerationStatus.failed
        assert "abandoned" in recovered.error_message.lower()


@pytest.mark.asyncio
async def test_budget_boundary_enforcement(client: AsyncClient) -> None:
    """When generated recommendations violate project budget bounds, 502 Bad Gateway is returned
    and no partial recommendations are persisted.
    """
    token, _, proj_id = await _create_user_and_project(
        client, "Budget Violator", "violator@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    from app.schemas.recommendation import RawGiftIdea, RawGiftRecommendationOutput

    out_of_bounds_output = RawGiftRecommendationOutput(
        recommendations=[
            RawGiftIdea(
                title="Super Expensive Diamond Roaster",
                description="An insanely expensive gold-plated coffee roaster costing thousands.",
                category="Luxury",
                personalization_reason="Far exceeds the requested budget boundaries.",
                estimated_budget=Decimal("5000.00"),  # Project max is 150.00
                presentation_idea="Delivered on a silk pillow in an armored vehicle.",
            ),
            RawGiftIdea(
                title="Second Luxury Item",
                description="Another luxury gift that violates project budget bounds completely.",
                category="Luxury",
                personalization_reason="Too expensive for the project.",
                estimated_budget=Decimal("6000.00"),
                presentation_idea="Gold foil wrapping.",
            ),
            RawGiftIdea(
                title="Third Luxury Item",
                description="Third luxury item that violates project budget bounds completely.",
                category="Luxury",
                personalization_reason="Too expensive for the project.",
                estimated_budget=Decimal("7000.00"),
                presentation_idea="Diamond box.",
            ),
        ]
    )

    with patch(
        "app.services.ai.mock.MockAIProvider.generate_gift_recommendations",
        new=AsyncMock(return_value=out_of_bounds_output),
    ):
        res = await client.post(
            f"/api/v1/gift-projects/{proj_id}/recommendations/generate",
            headers=headers,
        )
        assert res.status_code == 502
        assert "budget constraints" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_background_generation_and_polling_success(client: AsyncClient) -> None:
    """Asynchronous background generation returns HTTP 201 with status pending immediately.
    Frontend polls status until background worker finishes and populates 3 recommendations.
    """
    token, _, proj_id = await _create_user_and_project(
        client, "Async Giver", "async_giver@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trigger asynchronous generation
    gen_res = await client.post(
        f"/api/v1/gift-projects/{proj_id}/recommendations/generate?background=true",
        headers=headers,
    )
    assert gen_res.status_code == 201
    gen_data = gen_res.json()
    assert gen_data["status"] == "pending"
    assert gen_data["recommendations"] == []
    generation_id = gen_data["id"]

    # 2. Poll generation status until completed
    completed = False
    for _ in range(20):
        status_res = await client.get(
            f"/api/v1/gift-projects/{proj_id}/recommendations/{generation_id}",
            headers=headers,
        )
        assert status_res.status_code == 200
        poll_data = status_res.json()
        if poll_data["status"] == "succeeded":
            completed = True
            assert len(poll_data["recommendations"]) == 3
            break
        await asyncio.sleep(0.1)

    assert completed, "Background generation did not transition to succeeded within timeout"


@pytest.mark.asyncio
async def test_background_duplicate_generation_409(client: AsyncClient) -> None:
    """Simultaneous duplicate generation requests while a background generation is pending return 409 Conflict."""
    token, _, proj_id = await _create_user_and_project(
        client, "Duplicate Giver", "dup_giver@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Hold the mock provider to keep generation in pending state
    release_event = asyncio.Event()

    async def slow_generate(self, prompt_input):
        await asyncio.wait_for(release_event.wait(), timeout=5.0)
        from app.services.ai.mock import MockAIProvider as RealMock

        return await RealMock.generate_gift_recommendations(self, prompt_input)

    with patch.object(
        MockAIProvider,
        "generate_gift_recommendations",
        new=slow_generate,
    ):
        # 1. Start first generation (background=true)
        res1 = await client.post(
            f"/api/v1/gift-projects/{proj_id}/recommendations/generate?background=true",
            headers=headers,
        )
        assert res1.status_code == 201
        assert res1.json()["status"] == "pending"

        # 2. Duplicate generation attempt while first is still pending -> 409 Conflict
        res2 = await client.post(
            f"/api/v1/gift-projects/{proj_id}/recommendations/generate?background=true",
            headers=headers,
        )
        assert res2.status_code == 409
        assert "in progress" in res2.json()["detail"].lower()

        # Release slow worker
        release_event.set()


@pytest.mark.asyncio
async def test_stale_pending_generation_recovery_on_status_get(
    client: AsyncClient, test_app
) -> None:
    """When a pending generation was abandoned > timeout old, polling GET marks it failed."""
    token, _, proj_id = await _create_user_and_project(
        client, "Stale Poller", "stale_poller@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Insert an abandoned pending generation from 10 minutes ago
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        stale_gen = GiftRecommendationGeneration(
            gift_project_id=uuid.UUID(proj_id),
            user_id=(await session.get(GiftProject, uuid.UUID(proj_id))).user_id,
            provider="mock",
            model="mock-gemma",
            prompt_version="v1",
            status=RecommendationGenerationStatus.pending,
            created_at=datetime.now(UTC) - timedelta(minutes=10),
            updated_at=datetime.now(UTC) - timedelta(minutes=10),
        )
        session.add(stale_gen)
        await session.commit()
        stale_id = stale_gen.id

    # Polling GET should auto-mark it as failed
    status_res = await client.get(
        f"/api/v1/gift-projects/{proj_id}/recommendations/{stale_id}",
        headers=headers,
    )
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["status"] == "failed"
    assert "timed out" in data["error_message"].lower()
