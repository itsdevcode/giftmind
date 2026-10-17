import asyncio
import time
from collections import defaultdict
from dataclasses import dataclass, field

from fastapi import HTTPException, Request, status


@dataclass
class RateLimitRecord:
    timestamps: list[float] = field(default_factory=list)


class InMemoryRateLimiter:
    """Bounded in-memory sliding-window rate limiter for authentication endpoints.

    Identifies clients strictly using trusted network peer connection IP (request.client.host).
    Does NOT trust spoofable proxy headers like X-Forwarded-For unless a trusted reverse proxy
    middleware is explicitly configured upstream.

    Storage Mechanism Limitations:
    - In-Memory only: state is local to a single worker process and does not synchronize
      across horizontally-scaled backend replicas. In multi-worker or multi-node production
      deployments, a centralized high-availability store (e.g., Redis or Valkey) should be
      used to share rate-limit state across instances.
    - Process restarts clear counters.
    - Periodic garbage collection purges stale records to keep memory bounded.
    """

    def __init__(self, requests_per_minute: int = 10, window_seconds: int = 60) -> None:
        self.requests_per_minute = requests_per_minute
        self.window_seconds = window_seconds
        self._records: dict[str, RateLimitRecord] = defaultdict(RateLimitRecord)
        self._lock = asyncio.Lock()
        self._last_cleanup = time.time()

    def _cleanup_stale_records(self, now: float) -> None:
        """Purge entries older than window_seconds to bound memory consumption."""
        if now - self._last_cleanup < self.window_seconds:
            return
        cutoff = now - self.window_seconds
        keys_to_delete = []
        for key, record in self._records.items():
            record.timestamps = [ts for ts in record.timestamps if ts > cutoff]
            if not record.timestamps:
                keys_to_delete.append(key)
        for key in keys_to_delete:
            del self._records[key]
        self._last_cleanup = now

    async def check_rate_limit(self, key: str) -> None:
        async with self._lock:
            now = time.time()
            self._cleanup_stale_records(now)

            record = self._records[key]
            cutoff = now - self.window_seconds
            record.timestamps = [ts for ts in record.timestamps if ts > cutoff]

            if len(record.timestamps) >= self.requests_per_minute:
                retry_after = int(self.window_seconds - (now - record.timestamps[0])) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many authentication attempts. Please try again later.",
                    headers={"Retry-After": str(max(1, retry_after))},
                )

            record.timestamps.append(now)

    def reset(self) -> None:
        """Reset all rate limiter records (useful in tests)."""
        self._records.clear()


# Default auth rate limiter: max 10 attempts per minute per client IP
auth_rate_limiter = InMemoryRateLimiter(requests_per_minute=10, window_seconds=60)


async def rate_limit_auth(request: Request) -> None:
    """FastAPI dependency to throttle sensitive authentication endpoints by client IP."""
    client_ip = request.client.host if request.client else "unknown"
    await auth_rate_limiter.check_rate_limit(client_ip)
