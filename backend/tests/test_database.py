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
    """Declarative Base should have initialized metadata with Phase 2 domain tables."""
    assert Base.metadata is not None
    # Phase 2 tables: users, recipients, gift_projects, refresh_tokens
    registered_tables = set(Base.metadata.tables.keys())
    assert {"users", "recipients", "gift_projects", "refresh_tokens"}.issubset(registered_tables)


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
async def test_uncommitted_database_write_is_rolled_back_across_sessions(
    test_settings: Settings,
) -> None:
    """Verify that an uncommitted database write is rolled back and cannot be observed across separate sessions."""
    app = create_app(settings=test_settings)

    # Persistent test table across sessions
    table_name = "test_persistence_items"

    @app.post("/items/uncommitted")
    async def create_uncommitted_item(session: Annotated[AsyncSession, Depends(get_db)]):
        # Insert without commit
        await session.execute(
            text(f"INSERT INTO {table_name} (id, name) VALUES (1, 'uncommitted_name')")
        )
        return {"status": "uncommitted_written"}

    @app.post("/items/committed")
    async def create_committed_item(session: Annotated[AsyncSession, Depends(get_db)]):
        # Insert with explicit commit
        await session.execute(
            text(f"INSERT INTO {table_name} (id, name) VALUES (2, 'committed_name')")
        )
        await session.commit()
        return {"status": "committed_written"}

    @app.get("/items/count")
    async def get_items_count(session: Annotated[AsyncSession, Depends(get_db)]):
        res = await session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        count = res.scalar()
        return {"count": count}

    async with app.router.lifespan_context(app):
        # 1. Set up persistent test table via app's session factory
        session_factory = app.state.session_factory
        async with session_factory() as setup_session:
            await setup_session.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
            await setup_session.execute(
                text(f"CREATE TABLE {table_name} (id INTEGER PRIMARY KEY, name TEXT)")
            )
            await setup_session.commit()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 2. Trigger route that inserts without calling session.commit()
            uncommitted_res = await client.post("/items/uncommitted")
            assert uncommitted_res.status_code == 200

            # 3. Query in a separate session via GET /items/count:
            # The uncommitted write must have been rolled back upon closing the first session!
            count_after_uncommitted = await client.get("/items/count")
            assert count_after_uncommitted.status_code == 200
            assert count_after_uncommitted.json()["count"] == 0

            # 4. For contrast, trigger route with explicit session.commit()
            committed_res = await client.post("/items/committed")
            assert committed_res.status_code == 200

            # 5. Query in another separate session: the committed write IS persisted!
            count_after_committed = await client.get("/items/count")
            assert count_after_committed.status_code == 200
            assert count_after_committed.json()["count"] == 1

        # 6. Cleanup persistent test table
        async with session_factory() as cleanup_session:
            await cleanup_session.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
            await cleanup_session.commit()
