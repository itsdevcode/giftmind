import asyncio
import os
import uuid

import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command


@pytest.mark.asyncio
async def test_alembic_migrations_upgrade_and_downgrade_in_disposable_database() -> None:
    """Test full Alembic upgrade head and downgrade base cycle against a disposable PostgreSQL database."""
    base_db_url = os.environ.get("DATABASE_URL")
    if not base_db_url or not base_db_url.startswith("postgresql"):
        pytest.skip(
            "Alembic disposable database migration test requires PostgreSQL DATABASE_URL in environment."
        )

    # Create temporary database name
    disposable_db_name = f"disposable_test_{uuid.uuid4().hex[:8]}"

    # Connect to base postgres instance to execute CREATE DATABASE
    admin_engine = create_async_engine(base_db_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        await conn.execute(text(f"CREATE DATABASE {disposable_db_name}"))
    await admin_engine.dispose()

    # Build connection URL for disposable database
    # Split URL to swap database name
    prefix, _, _ = base_db_url.rpartition("/")
    disposable_db_url = f"{prefix}/{disposable_db_name}"

    try:
        # Run Alembic migrations programmatically
        alembic_cfg = Config("alembic.ini")
        alembic_cfg.set_main_option("sqlalchemy.url", disposable_db_url)

        # 1. Upgrade to head
        await asyncio.to_thread(command.upgrade, alembic_cfg, "head")

        # Verify tables created
        disposable_engine = create_async_engine(disposable_db_url)
        async with disposable_engine.connect() as conn:
            res = await conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                )
            )
            tables = {row[0] for row in res.fetchall()}
            assert {"users", "recipients", "gift_projects", "refresh_tokens"}.issubset(tables)

        # 2. Downgrade to base
        await asyncio.to_thread(command.downgrade, alembic_cfg, "base")

        # Verify tables dropped
        async with disposable_engine.connect() as conn:
            res = await conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                )
            )
            tables_after = {row[0] for row in res.fetchall()}
            assert not {"users", "recipients", "gift_projects", "refresh_tokens"}.intersection(
                tables_after
            )
        await disposable_engine.dispose()

    finally:
        # Cleanup disposable database
        admin_engine = create_async_engine(base_db_url, isolation_level="AUTOCOMMIT")
        async with admin_engine.connect() as conn:
            # Terminate active connections first
            await conn.execute(
                text(
                    f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{disposable_db_name}'"
                )
            )
            await conn.execute(text(f"DROP DATABASE IF EXISTS {disposable_db_name}"))
        await admin_engine.dispose()
