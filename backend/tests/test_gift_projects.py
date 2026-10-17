import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.models.gift_project import GiftProject


async def _create_test_user(client: AsyncClient, name: str, email: str) -> tuple[str, str]:
    """Helper to register a user and return (user_id, access_token)."""
    res = await client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    data = res.json()
    return data["user"]["id"], data["access_token"]


async def _create_test_recipient(client: AsyncClient, token: str, name: str) -> str:
    """Helper to create a recipient and return its ID."""
    res = await client.post(
        "/api/v1/recipients",
        json={"name": name, "relationship": "Friend", "interests": ["Books"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    return res.json()["id"]


@pytest.mark.asyncio
async def test_gift_project_crud_lifecycle(client: AsyncClient, test_app) -> None:
    """Create, read, update, list, and delete a gift project with budget checks."""
    _, token = await _create_test_user(client, "Project Creator", "creator@example.com")
    recipient_id = await _create_test_recipient(client, token, "Grandma")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Gift Project
    create_payload = {
        "recipient_id": recipient_id,
        "title": "75th Birthday Celebration",
        "occasion": "Birthday",
        "occasion_date": "2026-11-20",
        "budget_min": "50.00",
        "budget_max": "200.00",
        "currency": "USD",
        "status": "draft",
    }
    create_res = await client.post("/api/v1/gift-projects", json=create_payload, headers=headers)
    assert create_res.status_code == 201
    project_data = create_res.json()
    project_id = project_data["id"]

    assert project_data["title"] == "75th Birthday Celebration"
    assert project_data["occasion"] == "Birthday"
    assert project_data["occasion_date"] == "2026-11-20"
    assert project_data["budget_min"] == "50.00"
    assert project_data["budget_max"] == "200.00"
    assert project_data["status"] == "draft"

    # Verify persisted in database
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        p_db = await session.get(GiftProject, uuid.UUID(project_id))
        assert p_db is not None
        assert p_db.title == "75th Birthday Celebration"
        assert p_db.budget_min == Decimal("50.00")
        assert p_db.budget_max == Decimal("200.00")

    # 2. Get Gift Project by ID
    get_res = await client.get(f"/api/v1/gift-projects/{project_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == project_id

    # 3. Update Gift Project
    update_payload = {
        "title": "Updated 75th Birthday",
        "status": "in_progress",
        "budget_max": "250.00",
    }
    put_res = await client.put(
        f"/api/v1/gift-projects/{project_id}", json=update_payload, headers=headers
    )
    assert put_res.status_code == 200
    updated_data = put_res.json()
    assert updated_data["title"] == "Updated 75th Birthday"
    assert updated_data["status"] == "in_progress"
    assert updated_data["budget_max"] == "250.00"
    assert updated_data["budget_min"] == "50.00"

    # 4. List Gift Projects
    list_res = await client.get("/api/v1/gift-projects", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] == 1
    assert len(list_data["items"]) == 1
    assert list_data["items"][0]["id"] == project_id

    # 5. Delete Gift Project
    del_res = await client.delete(f"/api/v1/gift-projects/{project_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify deleted in database
    async with session_factory() as session:
        del_p = await session.get(GiftProject, uuid.UUID(project_id))
        assert del_p is None

    # Subsequent GET returns 404
    assert (
        await client.get(f"/api/v1/gift-projects/{project_id}", headers=headers)
    ).status_code == 404


@pytest.mark.asyncio
async def test_gift_project_budget_validation(client: AsyncClient) -> None:
    """Gift project budget_max < budget_min must fail validation (422)."""
    _, token = await _create_test_user(client, "Budget Tester", "budget@example.com")
    rec_id = await _create_test_recipient(client, token, "Brother")
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid create (max < min)
    bad_create = {
        "recipient_id": rec_id,
        "title": "Anniversary Gift",
        "occasion": "Anniversary",
        "budget_min": "100.00",
        "budget_max": "50.00",
        "currency": "USD",
    }
    res = await client.post("/api/v1/gift-projects", json=bad_create, headers=headers)
    assert res.status_code == 422

    # Negative budget_min
    bad_negative = {
        "recipient_id": rec_id,
        "title": "Anniversary Gift",
        "occasion": "Anniversary",
        "budget_min": "-10.00",
        "budget_max": "50.00",
        "currency": "USD",
    }
    res2 = await client.post("/api/v1/gift-projects", json=bad_negative, headers=headers)
    assert res2.status_code == 422


@pytest.mark.asyncio
async def test_gift_project_ownership_and_cross_user_isolation(client: AsyncClient) -> None:
    """User B cannot create gift project referencing User A's recipient, nor read/write User A's project."""
    _, token_a = await _create_test_user(client, "User Alpha", "alpha@example.com")
    _, token_b = await _create_test_user(client, "User Beta", "beta@example.com")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates recipient and project
    rec_a = await _create_test_recipient(client, token_a, "Alpha's Sibling")
    proj_res = await client.post(
        "/api/v1/gift-projects",
        json={
            "recipient_id": rec_a,
            "title": "Alpha Project",
            "occasion": "Graduation",
            "budget_min": "10.00",
            "budget_max": "50.00",
        },
        headers=headers_a,
    )
    assert proj_res.status_code == 201
    proj_a_id = proj_res.json()["id"]

    # 1. User B tries to create project using User A's recipient -> 404 (ownership check)
    cross_create_res = await client.post(
        "/api/v1/gift-projects",
        json={
            "recipient_id": rec_a,
            "title": "Beta Intrusion",
            "occasion": "Birthday",
            "budget_min": "10.00",
            "budget_max": "50.00",
        },
        headers=headers_b,
    )
    assert cross_create_res.status_code == 404

    # 2. User B tries to GET User A's project -> 404
    assert (
        await client.get(f"/api/v1/gift-projects/{proj_a_id}", headers=headers_b)
    ).status_code == 404

    # 3. User B tries to PUT User A's project -> 404
    assert (
        await client.put(
            f"/api/v1/gift-projects/{proj_a_id}",
            json={"title": "Hacked Title"},
            headers=headers_b,
        )
    ).status_code == 404

    # 4. User B tries to DELETE User A's project -> 404
    assert (
        await client.delete(f"/api/v1/gift-projects/{proj_a_id}", headers=headers_b)
    ).status_code == 404


@pytest.mark.asyncio
async def test_gift_project_pagination(client: AsyncClient) -> None:
    """Verify deterministic pagination on /gift-projects."""
    _, token = await _create_test_user(client, "Project Pagination", "proj_pagi@example.com")
    rec_id = await _create_test_recipient(client, token, "Friend")
    headers = {"Authorization": f"Bearer {token}"}

    for i in range(5):
        await client.post(
            "/api/v1/gift-projects",
            json={
                "recipient_id": rec_id,
                "title": f"Project {i}",
                "occasion": "Holiday",
                "budget_min": "10.00",
                "budget_max": "100.00",
            },
            headers=headers,
        )

    res = await client.get("/api/v1/gift-projects?limit=3&offset=0", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 5
    assert len(data["items"]) == 3
    assert data["limit"] == 3
    assert data["offset"] == 0
