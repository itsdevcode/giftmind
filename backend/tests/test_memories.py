import pytest
from httpx import AsyncClient


async def _create_test_user_and_project(
    client: AsyncClient, name: str, email: str
) -> tuple[str, str, str]:
    """Helper to register user, create recipient, and create gift project, returning (token, recipient_id, project_id)."""
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
            "name": "Clara Oswald",
            "relationship": "Best Friend",
            "interests": ["Astronomy", "Souffle Baking", "Time Travel"],
            "notes": "Loves vintage pocket watches.",
        },
        headers=headers,
    )
    assert rec_res.status_code == 201
    rec_id = rec_res.json()["id"]

    proj_res = await client.post(
        "/api/v1/gift-projects",
        json={
            "recipient_id": rec_id,
            "title": "Clara's Grand Celebration",
            "occasion": "Birthday",
            "budget_min": "50.00",
            "budget_max": "150.00",
            "currency": "USD",
        },
        headers=headers,
    )
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]
    return token, rec_id, proj_id


@pytest.mark.asyncio
async def test_get_memories_empty_state(client: AsyncClient):
    """Verify empty memory answers returns 200 with guidance explaining what's needed."""
    token, _, proj_id = await _create_test_user_and_project(
        client, "Alice Wonder", "alice_mem@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get(
        f"/api/v1/gift-projects/{proj_id}/memories",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["gift_project_id"] == proj_id
    assert data["answers"] == []
    assert data["has_sufficient_input"] is False
    assert "No memories shared yet" in data["guidance_message"]


@pytest.mark.asyncio
async def test_upsert_memories_atomic_and_idempotent(client: AsyncClient):
    """Verify upserting memory answers saves them, updates existing keys idempotently, and updates sufficient input flag."""
    token, _, proj_id = await _create_test_user_and_project(
        client, "Bob Builder", "bob_mem@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "answers": [
            {
                "question_key": "how_we_met",
                "answer": "We first met in the autumn at a small local library book club while debating Victorian time machines.",
            },
            {
                "question_key": "favorite_memory",
                "answer": "Stargazing on top of the hill last summer until sunrise, drinking thermos hot cocoa and laughing endlessly.",
            },
        ]
    }

    # First PUT
    res1 = await client.put(
        f"/api/v1/gift-projects/{proj_id}/memories",
        json=payload,
        headers=headers,
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert len(data1["answers"]) == 2
    assert data1["has_sufficient_input"] is True

    # Second PUT updates one answer and adds a third
    payload_update = {
        "answers": [
            {
                "question_key": "how_we_met",
                "answer": "UPDATED: We met on a rainy November Tuesday at the central community library.",
            },
            {
                "question_key": "gift_feeling",
                "answer": "I want Clara to feel loved, cherished, and reminded that no distance can dim our bond.",
            },
        ]
    }
    res2 = await client.put(
        f"/api/v1/gift-projects/{proj_id}/memories",
        json=payload_update,
        headers=headers,
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2["answers"]) == 3

    # Check updated answer content
    met_ans = next(a for a in data2["answers"] if a["question_key"] == "how_we_met")
    assert "UPDATED:" in met_ans["answer"]


@pytest.mark.asyncio
async def test_upsert_memories_invalid_key_rejected(client: AsyncClient):
    """Verify that unknown question keys are rejected with 422 Unprocessable Entity."""
    token, _, proj_id = await _create_test_user_and_project(
        client, "Charlie Day", "charlie_mem@example.com"
    )
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "answers": [
            {
                "question_key": "invalid_fake_key",
                "answer": "This should be rejected by the schema validator.",
            }
        ]
    }
    res = await client.put(
        f"/api/v1/gift-projects/{proj_id}/memories",
        json=payload,
        headers=headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_cross_user_isolation_memories(client: AsyncClient):
    """Verify that another user cannot view or mutate another user's project memories."""
    token_a, _, proj_a = await _create_test_user_and_project(
        client, "User One", "user1_mem@example.com"
    )
    token_b, _, _ = await _create_test_user_and_project(
        client, "User Two", "user2_mem@example.com"
    )

    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Attempt GET on User A's project
    res_get = await client.get(
        f"/api/v1/gift-projects/{proj_a}/memories",
        headers=headers_b,
    )
    assert res_get.status_code == 404

    # Attempt PUT on User A's project
    res_put = await client.put(
        f"/api/v1/gift-projects/{proj_a}/memories",
        json={"answers": [{"question_key": "how_we_met", "answer": "Malicious write attempt."}]},
        headers=headers_b,
    )
    assert res_put.status_code == 404
