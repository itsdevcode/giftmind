import asyncio
import logging
from collections.abc import Coroutine
from typing import Any

logger = logging.getLogger(__name__)


class BackgroundTaskManager:
    """Manages background asyncio tasks to prevent garbage collection
    and provide lifecycle tracking and graceful shutdown."""

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task[Any]] = set()

    @property
    def active_task_count(self) -> int:
        return len(self._tasks)

    def spawn(self, coro: Coroutine[Any, Any, Any], name: str | None = None) -> asyncio.Task[Any]:
        """Spawn a tracked background task with a strong reference and completion callback."""
        task = asyncio.create_task(coro, name=name)
        self._tasks.add(task)
        task.add_done_callback(self._on_task_done)
        logger.debug(
            "Spawned background task '%s' (active: %d)",
            task.get_name(),
            len(self._tasks),
        )
        return task

    def _on_task_done(self, task: asyncio.Task[Any]) -> None:
        self._tasks.discard(task)
        if not task.cancelled():
            exc = task.exception()
            if exc:
                logger.error(
                    "Background task '%s' failed with unhandled exception: %s",
                    task.get_name(),
                    exc,
                    exc_info=exc,
                )
            else:
                logger.debug("Background task '%s' completed successfully", task.get_name())

    async def shutdown(self, timeout: float = 5.0) -> None:
        """Cancel and await remaining background tasks on server shutdown."""
        if not self._tasks:
            return
        task_count = len(self._tasks)
        logger.info("Gracefully shutting down %d active background tasks...", task_count)
        for task in self._tasks:
            task.cancel()

        try:
            async with asyncio.timeout(timeout):
                await asyncio.gather(*self._tasks, return_exceptions=True)
        except TimeoutError:
            logger.warning(
                "Timed out waiting for %d background tasks to finish during shutdown",
                len(self._tasks),
            )
        finally:
            self._tasks.clear()


task_manager = BackgroundTaskManager()
