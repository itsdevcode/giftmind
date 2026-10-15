# GiftMind Backend API

Turn Memories Into Meaningful Gifts - FastAPI backend for GiftMind.

## Requirements
- Python >= 3.12
- [uv](https://docs.astral.sh/uv/) for package and environment management

## Setup & Running
```bash
# Run tests
uv run --all-extras pytest

# Run linter
uv run --all-extras ruff check .

# Start dev server
uv run uvicorn app.main:app --reload
```
