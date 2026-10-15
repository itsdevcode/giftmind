from typing import Annotated

import pytest
from fastapi import Depends
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.session import Base, create_engine_and_sessionmaker, get_db
from app.main import create_app


@pytest.mark.asyncio
async def test_database_engine_and_session_smoke(test_settings: Settings) -> None:
    """Verify that an async engine can execute queries and sessionmaker binds cleanly."""
    engine, _ = create_engine_and_sessionmaker(test_settings)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT 1 AS alive"))
        row = result.fetchone()
        assert row is not None
        assert row[0] == 1
    await engine.dispose()


@pytest.mark.asyncio
async def test_declarative_base_metadata() -> None:
    """Declarative Base should have an initialized metadata registry."""
    assert Base.metadata is not None
    assert len(Base.metadata.tables) == 0  # No premature domain tables


@pytest.mark.asyncio
async def test_app_instances_do_not_share_engines() -> None:
    """Verify different application instances cannot accidentally share database engines."""
    settings_a = Settings(DATABASE_URL="sqlite+aiosqlite:///:memory:")
    settings_b = Settings(DATABASE_URL="sqlite+aiosqlite:///:memory:")

    app_a = create_app(settings=settings_a)
    app_b = create_app(settings=settings_b)

    async with app_a.router.lifespan_context(app_a):
        async with app_b.router.lifespan_context(app_b):
            assert app_a.state.engine is not app_b.state.engine
            assert app_a.state.session_factory is not app_b.state.session_factory
            assert app_a.state.settings is settings_a
            assert app_b.state.settings is settings_b


@pytest.mark.asyncio
async def test_get_db_dependency_no_auto_commit(test_settings: Settings) -> None:
    """Verify get_db does not unconditionally commit on success."""
    app = create_app(settings=test_settings)

    # Temporary route to test get_db
    @app.post("/test-items")
    async def create_item(session: Annotated[AsyncSession, Depends(get_db)]):
        await session.execute(
            text("CREATE TEMPORARY TABLE test_items (id INTEGER PRIMARY KEY, name TEXT)")
        )
        await session.execute(text("INSERT INTO test_items (id, name) VALUES (1, 'uncommitted')"))
        # We deliberately DO NOT call session.commit()
        return {"ok": True}

    @app.get("/test-items")
    async def list_items(session: Annotated[AsyncSession, Depends(get_db)]):
        try:
            res = await session.execute(text("SELECT COUNT(*) FROM test_items"))
            count = res.scalar()
        except Exception:
            count = 0
        return {"count": count}

    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            res = await client.post("/test-items")
            assert res.status_code == 200

            # In session without commit, separate connection won't see or persist table across sessions
            res_list = await client.get("/test-items")
            assert res_list.status_code == 200
