import uuid

import pytest
from httpx import AsyncClient

from app.models.recipient import Recipient


async def _create_test_user(client: AsyncClient, name: str, email: str) -> tuple[str, str]:
    """Helper to register a user and return (user_id, access_token)."""
    res = await client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    data = res.json()
    return data["user"]["id"], data["access_token"]


@pytest.mark.asyncio
async def test_recipient_crud_lifecycle(client: AsyncClient, test_app) -> None:
    """Create, read, update, list, and delete a recipient for an authenticated user."""
    _, token = await _create_test_user(client, "User One", "user1@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Recipient
    create_payload = {
        "name": "Sarah Connor",
        "relationship": "Mom",
        "interests": ["Gardening", "Sci-Fi novels", "Coffee"],
        "notes": "Loves Earl Grey tea and indoor houseplants.",
    }
    create_res = await client.post("/api/v1/recipients", json=create_payload, headers=headers)
    assert create_res.status_code == 201
    recipient_data = create_res.json()
    recipient_id = recipient_data["id"]

    assert recipient_data["name"] == "Sarah Connor"
    assert recipient_data["relationship"] == "Mom"
    assert recipient_data["interests"] == ["Gardening", "Sci-Fi novels", "Coffee"]
    assert recipient_data["notes"] == "Loves Earl Grey tea and indoor houseplants."

    # Verify persisted in database
    session_factory = test_app.state.session_factory
    async with session_factory() as session:
        r_db = await session.get(Recipient, uuid.UUID(recipient_id))
        assert r_db is not None
        assert r_db.name == "Sarah Connor"
        assert r_db.relationship_type == "Mom"

    # 2. Get Recipient by ID
    get_res = await client.get(f"/api/v1/recipients/{recipient_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Sarah Connor"

    # 3. Update Recipient
    update_payload = {
        "relationship": "Mother",
        "interests": ["Gardening", "Bonsai"],
    }
    put_res = await client.put(
        f"/api/v1/recipients/{recipient_id}", json=update_payload, headers=headers
    )
    assert put_res.status_code == 200
    updated_data = put_res.json()
    assert updated_data["relationship"] == "Mother"
    assert updated_data["interests"] == ["Gardening", "Bonsai"]
    # Unchanged fields remain intact
    assert updated_data["name"] == "Sarah Connor"
    assert updated_data["notes"] == "Loves Earl Grey tea and indoor houseplants."

    # 4. List Recipients
    list_res = await client.get("/api/v1/recipients", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] == 1
    assert len(list_data["items"]) == 1
    assert list_data["items"][0]["id"] == recipient_id

    # 5. Delete Recipient
    del_res = await client.delete(f"/api/v1/recipients/{recipient_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify deleted from database
    async with session_factory() as session:
        deleted_r = await session.get(Recipient, uuid.UUID(recipient_id))
        assert deleted_r is None

    # Subsequent GET returns 404
    not_found_res = await client.get(f"/api/v1/recipients/{recipient_id}", headers=headers)
    assert not_found_res.status_code == 404


@pytest.mark.asyncio
async def test_recipient_ownership_isolation(client: AsyncClient) -> None:
    """User B cannot access, modify or delete User A's recipients (must return 404)."""
    _, user_a_token = await _create_test_user(client, "Owner A", "owner_a@example.com")
    _, user_b_token = await _create_test_user(client, "Owner B", "owner_b@example.com")

    headers_a = {"Authorization": f"Bearer {user_a_token}"}
    headers_b = {"Authorization": f"Bearer {user_b_token}"}

    # User A creates recipient
    create_res = await client.post(
        "/api/v1/recipients",
        json={"name": "Alice's Friend", "relationship": "Friend", "interests": []},
        headers=headers_a,
    )
    assert create_res.status_code == 201
    rec_id = create_res.json()["id"]

    # User B listing should return empty list
    list_b = await client.get("/api/v1/recipients", headers=headers_b)
    assert list_b.status_code == 200
    assert list_b.json()["total"] == 0
    assert len(list_b.json()["items"]) == 0

    # User B attempting GET, PUT, DELETE User A's recipient -> 404
    get_b = await client.get(f"/api/v1/recipients/{rec_id}", headers=headers_b)
    assert get_b.status_code == 404

    put_b = await client.put(
        f"/api/v1/recipients/{rec_id}",
        json={"name": "Hijacked"},
        headers=headers_b,
    )
    assert put_b.status_code == 404

    del_b = await client.delete(f"/api/v1/recipients/{rec_id}", headers=headers_b)
    assert del_b.status_code == 404


@pytest.mark.asyncio
async def test_recipient_pagination(client: AsyncClient) -> None:
    """Verify deterministic pagination on /recipients."""
    _, token = await _create_test_user(client, "Paginated User", "paginated@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Create 5 recipients
    for i in range(5):
        await client.post(
            "/api/v1/recipients",
            json={"name": f"Recipient {i}", "relationship": "Colleague", "interests": []},
            headers=headers,
        )

    # Page 1: limit 2, offset 0
    res1 = await client.get("/api/v1/recipients?limit=2&offset=0", headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["total"] == 5
    assert len(data1["items"]) == 2
    assert data1["limit"] == 2
    assert data1["offset"] == 0

    # Page 2: limit 2, offset 2
    res2 = await client.get("/api/v1/recipients?limit=2&offset=2", headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2["items"]) == 2

    # Distinct items across pages
    items_page1 = {item["id"] for item in data1["items"]}
    items_page2 = {item["id"] for item in data2["items"]}
    assert items_page1.isdisjoint(items_page2)
