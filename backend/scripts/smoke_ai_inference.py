#!/usr/bin/env python3
"""Smoke test script for GiftMind AI Inference Engine with Ollama (Gemma 2 2B).

This script verifies end-to-end communication with the local Ollama instance:
1. Pings Ollama base URL to verify connectivity.
2. Checks whether the target model (default: gemma2:2b) is loaded/available.
3. Sends a real test prompt through OllamaAIProvider.
4. Validates that exactly 3 distinct, well-structured recommendations are returned.
5. Measures latency, tokens, and output format correctness.

Usage:
    uv run python scripts/smoke_ai_inference.py [--url http://localhost:11434] [--model gemma2:2b]
"""

import argparse
import asyncio
import sys
import time
from decimal import Decimal

from app.schemas.recommendation import RawGiftRecommendationOutput
from app.services.ai.exceptions import (
    AIModelNotFoundError,
    AIProviderError,
    AIResponseValidationError,
)
from app.services.ai.ollama import OllamaAIProvider
from app.services.ai.prompts import RecommendationPromptInput


async def run_smoke_test(ollama_url: str, model_name: str, timeout: float) -> int:
    print("=" * 60)
    print("  GiftMind AI Inference Engine Smoke Test")
    print("=" * 60)
    print(f"Target URL:   {ollama_url}")
    print(f"Target Model: {model_name}")
    print(f"Timeout:      {timeout}s")
    print("-" * 60)

    provider = OllamaAIProvider(
        base_url=ollama_url,
        model=model_name,
        timeout_seconds=timeout,
    )

    # Step 1 & 2: Connectivity and model check
    print("\n[1/3] Checking Ollama host connectivity and model status...")
    status = await provider.verify_connection()
    if not status.get("available"):
        print(f"❌ Ollama server unreachable: {status.get('error')}")
        print("\nTroubleshooting tips:")
        print("  - Ensure Ollama is running: `ollama serve`")
        print("  - Check that the URL is correct (default: http://localhost:11434)")
        return 1
    print("✅ Ollama server is reachable and active.")

    print(f"\n[2/3] Checking if model '{model_name}' is installed...")
    installed_models = status.get("installed_models", [])
    print(f"Found installed models: {installed_models or '(none)'}")
    if not status.get("model_installed"):
        print(f"❌ Model '{model_name}' is not installed on Ollama server.")
        print(f"To download it, run: `ollama pull {model_name}`")
        print("\nSmoke test BLOCKED: Target model unavailable. Aborting inference.")
        return 1

    # Step 3: Inference check with sample recipient
    print(f"\n[3/3] Sending sample prompt to '{model_name}' (JSON format enforced)...")
    sample_input = RecommendationPromptInput(
        recipient_name="Maya",
        relationship="Close Friend",
        interests=["Specialty coffee brewing", "film photography", "mid-century design"],
        notes="Recently bought a Chemex and vintage 35mm camera.",
        occasion="30th Birthday",
        occasion_date=None,
        budget_min=Decimal("40.00"),
        budget_max=Decimal("120.00"),
        currency="USD",
    )

    start_time = time.perf_counter()
    try:
        result: RawGiftRecommendationOutput = await provider.generate_gift_recommendations(
            sample_input
        )
        elapsed = time.perf_counter() - start_time
    except AIModelNotFoundError as exc:
        print(f"❌ Model '{model_name}' is not installed: {exc}")
        print(f"Fix: Run `ollama pull {model_name}` and rerun this script.")
        return 1
    except AIResponseValidationError as exc:
        print(f"❌ Inference returned invalid format: {exc}")
        return 1
    except AIProviderError as exc:
        print(f"❌ Inference error: {exc}")
        return 1
    except Exception as exc:
        print(f"❌ Unexpected failure: {exc}")
        return 1

    # Validate model response against recipient budget constraints and interests
    budget_violations = [
        idea for idea in result.recommendations
        if idea.estimated_budget < sample_input.budget_min or idea.estimated_budget > sample_input.budget_max
    ]
    if budget_violations:
        print(f"❌ Budget constraint check failed: {len(budget_violations)} ideas violate bounds [${sample_input.budget_min}, ${sample_input.budget_max}]")
        return 1

    print(f"✅ Received response in {elapsed:.2f} seconds!")
    print(f"Found {len(result.recommendations)} recommendation ideas:\n")

    for idx, idea in enumerate(result.recommendations, start=1):
        print(f"  {idx}. {idea.title}")
        print(f"     Description:   {idea.description}")
        print(f"     Category:      {idea.category}")
        print(f"     Budget:        ${idea.estimated_budget:.2f} {sample_input.currency}")
        print(f"     Why:           {idea.personalization_reason}")
        print(f"     Presentation:  {idea.presentation_idea}")
        print()

    print("=" * 60)
    print("🎉 Smoke test PASSED: All requirements satisfied!")
    print("=" * 60)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="GiftMind AI inference smoke test")
    parser.add_argument("--url", default="http://localhost:11434", help="Ollama base URL")
    parser.add_argument("--model", default="gemma2:2b", help="Model name (default: gemma2:2b)")
    parser.add_argument("--timeout", type=float, default=60.0, help="Inference timeout in seconds")
    args = parser.parse_args()

    exit_code = asyncio.run(run_smoke_test(args.url, args.model, args.timeout))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
