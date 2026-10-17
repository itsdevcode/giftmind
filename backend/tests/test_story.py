import asyncio
import io

import pypdf
import pytest
from httpx import AsyncClient

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
            f"The stars in Orion's belt shone with timeless luminescence — a quiet reminder of infinite horizons. "
            * 3
            for i in range(1, 10)
        ]
    )
    patch_payload = {
        "title": "Château & Étoiles: A Keepsake for Eleanor",
        "dedication": "Dédié à ma chère sœur Eleanor — with all my heart & gratitude.",
        "story_body": long_paragraphs,
        "closing_message": "Avec tout notre amour pour toujours.",
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
    """Verify simultaneous story generation requests result in one success and one 409 Conflict."""
    token, _, proj_id = await _create_test_user_project_and_memories(
        client, "Hannah Abbott", "hannah_concurrency@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    orig_generate = MockAIProvider.generate_story_keepsake

    async def slow_generate(self, prompt_input):
        await asyncio.sleep(0.4)
        return await orig_generate(self, prompt_input)

    monkeypatch.setattr(MockAIProvider, "generate_story_keepsake", slow_generate)

    # Launch two simultaneous requests
    req1 = client.post(
        f"/api/v1/gift-projects/{proj_id}/story/generate",
        headers=headers,
    )
    req2 = client.post(
        f"/api/v1/gift-projects/{proj_id}/story/generate",
        headers=headers,
    )

    r1, r2 = await asyncio.gather(req1, req2)
    statuses = sorted([r1.status_code, r2.status_code])
    assert statuses == [201, 409]
