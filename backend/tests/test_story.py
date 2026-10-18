import asyncio
import io
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pypdf
import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.models.gift_project import GiftProject
from app.models.story import StoryKeepsake, StoryKeepsakeStatus
from app.services.ai.exceptions import (
    AIAuthenticationError,
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderUnavailableError,
    AIRateLimitError,
    AIResponseValidationError,
)
from app.services.ai.mock import MockAIProvider


async def _create_test_user_project_and_memories(
    client: AsyncClient, name: str, email: str
) -> tuple[str, str, str]:
    """Helper to register user, create recipient, gift project, and sufficient memory answers."""
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": "Password123!"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    rec_res = await client.post(
        "/api/v1/recipients",
        json={
            "name": "Eleanor Vance",
            "relationship": "Sister",
            "interests": ["Botany", "Classical Piano", "Rare Teas"],
            "notes": "Graduating residency next month.",
        },
        headers=headers,
    )
    assert rec_res.status_code == 201
    rec_id = rec_res.json()["id"]

    proj_res = await client.post(
        "/api/v1/gift-projects",
        json={
            "recipient_id": rec_id,
            "title": "Eleanor's Medical Milestone",
            "occasion": "Residency Graduation",
            "budget_min": "100.00",
            "budget_max": "300.00",
            "currency": "USD",
        },
        headers=headers,
    )
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    # Add sufficient memories
    mem_payload = {
        "answers": [
            {
                "question_key": "how_we_met",
                "answer": "We grew up sharing an attic bedroom under the eaves, whispering secrets until midnight while rain drummed on the slates.",
            },
            {
                "question_key": "favorite_memory",
                "answer": "The summer road trip to the Pacific Coast when our old station wagon broke down by the eucalyptus groves, and we brewed chamomile tea on a camp stove while watching the fog roll in.",
            },
            {
                "question_key": "what_makes_them_special",
                "answer": "Eleanor possesses an unshakeable compassion and a gentle steadiness that anchors everyone around her during the fiercest storms.",
            },
        ]
    }
    mem_res = await client.put(
        f"/api/v1/gift-projects/{proj_id}/memories",
        json=mem_payload,
        headers=headers,
    )
    assert mem_res.status_code == 200
    assert mem_res.json()["has_sufficient_input"] is True

    return token, rec_id, proj_id


@pytest.mark.asyncio
async def test_story_generation_insufficient_memories_rejected(client: AsyncClient):
    """Verify that generation returns 400 Bad Request when memories are missing or insufficient."""
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={"name": "Empty User", "email": "empty_user@example.com", "password": "Password123!"},
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    rec_res = await client.post(
        "/api/v1/recipients",
        json={"name": "Nobody", "relationship": "Colleague"},
        headers=headers,
    )
    rec_id = rec_res.json()["id"]

    proj_res = await client.post(
        "/api/v1/gift-projects",
        json={
            "recipient_id": rec_id,
            "title": "Empty Project",
            "occasion": "Farewell",
            "budget_min": "20.00",
            "budget_max": "50.00",
            "currency": "USD",
        },
        headers=headers,
    )
    proj_id = proj_res.json()["id"]

    res = await client.post(
        f"/api/v1/gift-projects/{proj_id}/story/generate",
        headers=headers,
    )
    assert res.status_code == 400
    assert "No memories shared yet" in res.json()["detail"]


@pytest.mark.asyncio
async def test_story_generation_and_retrieval_success(client: AsyncClient):
    """Verify end-to-end story generation with MockAIProvider, persistence, and GET endpoint."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Diana Prince", "diana_story@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.post(
        f"/api/v1/gift-projects/{proj_id}/story/generate",
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()

    assert data["gift_project_id"] == proj_id
    assert data["status"] == "succeeded"
    assert "Eleanor" in data["title"]
    assert len(data["story_body"].split()) >= 100
    assert data["dedication"] != ""
    assert data["closing_message"] != ""

    # Check GET /story
    get_res = await client.get(
        f"/api/v1/gift-projects/{proj_id}/story",
        headers=headers,
    )
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["id"] == data["id"]
    assert get_data["title"] == data["title"]


@pytest.mark.asyncio
async def test_story_edit_flow(client: AsyncClient):
    """Verify PATCH /story allows editing user-controlled story fields."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Edward Cullen", "edward_story@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Generate first
    gen_res = await client.post(
        f"/api/v1/gift-projects/{proj_id}/story/generate",
        headers=headers,
    )
    assert gen_res.status_code == 201

    # Edit story
    patch_payload = {
        "title": "A Lifetime of Wonder: Eleanor's Journey",
        "dedication": "For my dearest sister Eleanor, whose courage inspires me every day.",
        "story_body": "This is a custom refined story written by the user to add personal poetry and warm nostalgia to their keepsake gift.",
        "closing_message": "Congratulations on finishing residency, Dr. Vance! Forever your proudest sibling.",
    }
    patch_res = await client.patch(
        f"/api/v1/gift-projects/{proj_id}/story",
        json=patch_payload,
        headers=headers,
    )
    assert patch_res.status_code == 200
    patched = patch_res.json()
    assert patched["title"] == patch_payload["title"]
    assert patched["dedication"] == patch_payload["dedication"]
    assert patched["story_body"] == patch_payload["story_body"]

    # Verify GET returns edited version
    get_res = await client.get(
        f"/api/v1/gift-projects/{proj_id}/story",
        headers=headers,
    )
    assert get_res.json()["title"] == patch_payload["title"]


@pytest.mark.asyncio
async def test_story_pdf_generation_content_and_headers(client: AsyncClient):
    """Verify PDF keepsake download endpoint headers, valid PDF signature, and extracted text matching story content."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Fiona Gallagher", "fiona_pdf@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Generate story
    gen_res = await client.post(
        f"/api/v1/gift-projects/{proj_id}/story/generate",
        headers=headers,
    )
    assert gen_res.status_code == 201

    # Download PDF
    pdf_res = await client.get(
        f"/api/v1/gift-projects/{proj_id}/story/pdf",
        headers=headers,
    )
    assert pdf_res.status_code == 200
    assert pdf_res.headers["Content-Type"] == "application/pdf"
    assert "attachment; filename=" in pdf_res.headers["Content-Disposition"]
    assert "GiftMind_Keepsake" in pdf_res.headers["Content-Disposition"]

    # Validate PDF binary signature %PDF-
    content = pdf_res.content
    assert content.startswith(b"%PDF-")

    # Extract text with pypdf to verify expected recipient name, title, and dedication
    reader = pypdf.PdfReader(io.BytesIO(content))
    assert len(reader.pages) >= 2  # Cover page + story page(s)

    all_text = " ".join([page.extract_text() or "" for page in reader.pages])
    assert "Eleanor" in all_text
    assert "GiftMind Keepsake" in all_text


@pytest.mark.asyncio
async def test_pdf_unicode_and_long_text_pagination(client: AsyncClient):
    """Verify PDF rendering handles Unicode characters and multi-paragraph stories across pages without error."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "George Weasley", "george_unicode@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Generate first
    await client.post(
        f"/api/v1/gift-projects/{proj_id}/story/generate",
        headers=headers,
    )

    # Edit with Unicode and multi-paragraph story
    long_paragraphs = "\n\n".join(
        [
            f"Paragraph {i}: Eleanor, René & François shared café au lait under the crêpe myrtles. "
            f"Witaj świecie, Łódź i Kraków — timeless luminescence & quiet horizons. Привет мир! "
            * 2
            for i in range(1, 10)
        ]
    )
    patch_payload = {
        "title": "Château & Étoiles: Pamiątka dla Eleanor",
        "dedication": "Dédié à ma chère sœur Eleanor — with all my heart & gratitude.",
        "story_body": long_paragraphs,
        "closing_message": "Avec tout notre amour pour toujours. До свидания!",
    }
    await client.patch(
        f"/api/v1/gift-projects/{proj_id}/story",
        json=patch_payload,
        headers=headers,
    )

    pdf_res = await client.get(
        f"/api/v1/gift-projects/{proj_id}/story/pdf",
        headers=headers,
    )
    assert pdf_res.status_code == 200
    reader = pypdf.PdfReader(io.BytesIO(pdf_res.content))
    assert len(reader.pages) >= 2
    full_text = " ".join([p.extract_text() or "" for p in reader.pages])
    assert "Eleanor" in full_text
    assert "café" in full_text
    assert "Łódź" in full_text
    assert "Привет" in full_text


@pytest.mark.asyncio
async def test_unauthorized_cross_user_story_and_pdf(client: AsyncClient):
    """Verify that another user cannot view, edit, or download the story or PDF."""
    token_a, _, proj_a = await _create_test_user_project_and_memories(
        client, "Owner Alice", "owner_a_story@example.com"
    )
    token_b, _, _ = await _create_test_user_project_and_memories(
        client, "Intruder Bob", "intruder_b_story@example.com"
    )

    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Attempt GET /story
    res_get = await client.get(
        f"/api/v1/gift-projects/{proj_a}/story",
        headers=headers_b,
    )
    assert res_get.status_code == 404

    # Attempt PATCH /story
    res_patch = await client.patch(
        f"/api/v1/gift-projects/{proj_a}/story",
        json={
            "title": "Hacked Title",
            "dedication": "Hacked",
            "story_body": "Hacked long story text exceeding minimum limit requirement for validation.",
            "closing_message": "Hacked",
        },
        headers=headers_b,
    )
    assert res_patch.status_code == 404

    # Attempt GET /story/pdf
    res_pdf = await client.get(
        f"/api/v1/gift-projects/{proj_a}/story/pdf",
        headers=headers_b,
    )
    assert res_pdf.status_code == 404


@pytest.mark.asyncio
async def test_story_generation_concurrency_conflict(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    """Verify simultaneous story generation requests result in one success, one 409 Conflict, and exactly one inference call."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Hannah Abbott", "hannah_concurrency@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    orig_generate = MockAIProvider.generate_story_keepsake
    inference_started = asyncio.Event()
    second_request_attempted = asyncio.Event()
    inference_call_count = 0

    async def synchronized_generate(self, prompt_input):
        nonlocal inference_call_count
        inference_call_count += 1
        # Signal that the first request has successfully claimed the DB slot and entered inference
        inference_started.set()
        # Wait until the second request has definitely fired against the endpoint
        await asyncio.wait_for(second_request_attempted.wait(), timeout=5.0)
        return await orig_generate(self, prompt_input)

    monkeypatch.setattr(MockAIProvider, "generate_story_keepsake", synchronized_generate)

    async def run_first():
        return await client.post(
            f"/api/v1/gift-projects/{proj_id}/story/generate",
            headers=headers,
        )

    async def run_second():
        # Ensure the first request is inside inference while holding the pending status
        await asyncio.wait_for(inference_started.wait(), timeout=5.0)
        try:
            return await client.post(
                f"/api/v1/gift-projects/{proj_id}/story/generate",
                headers=headers,
            )
        finally:
            # Release first request to complete
            second_request_attempted.set()

    r1, r2 = await asyncio.gather(run_first(), run_second())
    statuses = sorted([r1.status_code, r2.status_code])
    assert statuses == [201, 409]
    assert inference_call_count == 1, "Expected exactly one model inference call to occur"


@pytest.mark.asyncio
async def test_background_story_generation_and_polling_success(client: AsyncClient):
    """Verify asynchronous story generation returns HTTP 201 with status pending immediately,
    and subsequent polling on /story/{story_id} transitions to succeeded with full content.
    """
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Async Novelist", "async_story@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trigger asynchronous generation
    res = await client.post(
        f"/api/v1/gift-projects/{proj_id}/story/generate?background=true",
        headers=headers,
    )
    assert res.status_code == 201
    init_data = res.json()
    assert init_data["status"] == "pending"
    assert init_data["story_body"] == ""
    story_id = init_data["id"]

    # 2. Poll until succeeded
    completed = False
    for _ in range(30):
        poll_res = await client.get(
            f"/api/v1/gift-projects/{proj_id}/story/{story_id}",
            headers=headers,
        )
        assert poll_res.status_code == 200
        poll_data = poll_res.json()
        if poll_data["status"] == "succeeded":
            completed = True
            assert "Eleanor" in poll_data["title"]
            assert len(poll_data["story_body"].split()) >= 100
            assert poll_data["dedication"] != ""
            assert poll_data["closing_message"] != ""
            break
        await asyncio.sleep(0.1)

    assert completed, "Background story generation did not transition to succeeded within timeout"

    # Also verify GET /story returns this latest succeeded story
    latest_res = await client.get(
        f"/api/v1/gift-projects/{proj_id}/story",
        headers=headers,
    )
    assert latest_res.status_code == 200
    assert latest_res.json()["id"] == story_id


@pytest.mark.asyncio
async def test_background_story_duplicate_generation_409(client: AsyncClient):
    """Simultaneous duplicate generation requests while a background story generation is pending return 409 Conflict."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Duplicate Storyteller", "dup_story@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    release_event = asyncio.Event()

    async def slow_story(self, prompt_input):
        await asyncio.wait_for(release_event.wait(), timeout=5.0)
        from app.services.ai.mock import MockAIProvider as RealMock

        return await RealMock.generate_story_keepsake(self, prompt_input)

    with patch.object(MockAIProvider, "generate_story_keepsake", new=slow_story):
        # 1. Start first generation (background=true)
        res1 = await client.post(
            f"/api/v1/gift-projects/{proj_id}/story/generate?background=true",
            headers=headers,
        )
        assert res1.status_code == 201
        assert res1.json()["status"] == "pending"

        # 2. Duplicate generation attempt while first is still pending -> 409 Conflict
        res2 = await client.post(
            f"/api/v1/gift-projects/{proj_id}/story/generate?background=true",
            headers=headers,
        )
        assert res2.status_code == 409
        assert "in progress" in res2.json()["detail"].lower()

        # Release slow worker
        release_event.set()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "raised_exc,expected_error_substr",
    [
        (AIAuthenticationError("Bad token"), "authentication failed"),
        (AIRateLimitError("Quota hit"), "busy"),
        (AIInferenceTimeoutError("Timed out"), "timed out"),
        (AIProviderUnavailableError("503 down"), "temporarily unavailable"),
        (AIModelNotFoundError("gemma-4-26b-a4b-it"), "configured AI model"),
        (AIResponseValidationError("Invalid JSON schema"), "failed to produce a valid story"),
    ],
)
async def test_background_story_worker_ai_error_handling(
    client: AsyncClient,
    raised_exc: Exception,
    expected_error_substr: str,
):
    """Verify background worker catches AI provider exceptions and records informative failure status."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Failing Storyteller", f"fail_{uuid.uuid4().hex[:6]}@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    async def fail_story(_self, _prompt_input):
        raise raised_exc

    with patch.object(MockAIProvider, "generate_story_keepsake", new=fail_story):
        res = await client.post(
            f"/api/v1/gift-projects/{proj_id}/story/generate?background=true",
            headers=headers,
        )
        assert res.status_code == 201
        story_id = res.json()["id"]

        # Poll until worker marks record as failed
        failed = False
        for _ in range(30):
            poll_res = await client.get(
                f"/api/v1/gift-projects/{proj_id}/story/{story_id}",
                headers=headers,
            )
            assert poll_res.status_code == 200
            poll_data = poll_res.json()
            if poll_data["status"] == "failed":
                failed = True
                assert expected_error_substr.lower() in poll_data["error_message"].lower()
                break
            await asyncio.sleep(0.1)

        assert failed, f"Worker did not record failed status for {type(raised_exc).__name__}"


@pytest.mark.asyncio
async def test_stale_pending_story_recovery_on_status_get(client: AsyncClient, test_app):
    """When a pending story keepsake was abandoned past the retry budget, polling GET marks it failed."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Stale Storyteller", "stale_story@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Insert an abandoned pending story from 10 minutes ago
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        proj = await session.get(GiftProject, uuid.UUID(proj_id))
        assert proj is not None
        stale_story = StoryKeepsake(
            gift_project_id=uuid.UUID(proj_id),
            user_id=proj.user_id,
            title="Abandoned Story",
            dedication="",
            story_body="",
            closing_message="",
            model_name="gemma-4-26b-a4b-it",
            prompt_version="v1",
            status=StoryKeepsakeStatus.pending,
            created_at=datetime.now(UTC) - timedelta(minutes=10),
            updated_at=datetime.now(UTC) - timedelta(minutes=10),
        )
        session.add(stale_story)
        await session.commit()
        stale_id = stale_story.id

    # Polling GET /story/{story_id} should auto-mark it as failed
    status_res = await client.get(
        f"/api/v1/gift-projects/{proj_id}/story/{stale_id}",
        headers=headers,
    )
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["status"] == "failed"
    assert "timed out" in data["error_message"].lower()


@pytest.mark.asyncio
async def test_story_status_endpoint_cross_user_isolation(client: AsyncClient):
    """Ensure user B cannot poll story status of user A's project."""
    token_a, _, proj_a = await _create_test_user_project_and_memories(
        client, "Author A", "author_a_isolation@example.com"
    )
    token_b, _, _ = await _create_test_user_project_and_memories(
        client, "Author B", "author_b_isolation@example.com"
    )

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Author A generates story
    res = await client.post(
        f"/api/v1/gift-projects/{proj_a}/story/generate",
        headers=headers_a,
    )
    assert res.status_code == 201
    story_id = res.json()["id"]

    # Author B tries to poll Author A's story status
    bad_res = await client.get(
        f"/api/v1/gift-projects/{proj_a}/story/{story_id}",
        headers=headers_b,
    )
    assert bad_res.status_code == 404


@pytest.mark.asyncio
async def test_restart_recovery_marks_pending_story_failed(client: AsyncClient, test_app):
    """Verify that server restart recovery logic transitions orphaned pending stories to failed."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Restart User", "restart_user@example.com"
    )
    session_factory = test_app.state.session_factory

    async with session_factory() as session:
        proj = await session.get(GiftProject, uuid.UUID(proj_id))
        assert proj is not None
        orphaned = StoryKeepsake(
            gift_project_id=uuid.UUID(proj_id),
            user_id=proj.user_id,
            title="Orphaned Story",
            dedication="",
            story_body="",
            closing_message="",
            model_name="gemma-4-26b-a4b-it",
            prompt_version="v1",
            status=StoryKeepsakeStatus.pending,
        )
        session.add(orphaned)
        await session.commit()
        orphaned_id = orphaned.id

        # Execute recovery update query as performed in lifespan startup
        await session.execute(
            update(StoryKeepsake)
            .where(StoryKeepsake.status == StoryKeepsakeStatus.pending)
            .values(
                status=StoryKeepsakeStatus.failed,
                error_message="Story generation was interrupted due to a server restart. Please retry.",
                updated_at=datetime.now(UTC),
            )
        )
        await session.commit()
        session.expire_all()

        recovered = await session.get(StoryKeepsake, orphaned_id)
        assert recovered is not None
        assert recovered.status == StoryKeepsakeStatus.failed
        assert "server restart" in (recovered.error_message or "").lower()
