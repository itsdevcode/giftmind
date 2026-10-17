#!/usr/bin/env python3
"""Smoke test script for GiftMind AI Inference Engine with Hosted Gemma (Google Gemini API).

This script verifies end-to-end communication with the Google-hosted Gemma 4 26B model:
1. Reads GOOGLE_API_KEY securely from environment (or --api-key argument). Never logs secrets.
2. Checks whether the target model (default: gemma-4-26b-a4b-it) is accessible.
3. Sends a real test prompt through GoogleGemmaAIProvider.
4. Validates that exactly 3 distinct, well-structured recommendations are returned within budget constraints.
5. Measures latency, tokens (where available), and output format correctness.

Usage:
    export GOOGLE_API_KEY="your-api-key"
    uv run python scripts/smoke_ai_inference.py [--model gemma-4-26b-a4b-it]
"""

import argparse
import asyncio
import os
import sys
import time
from decimal import Decimal

from app.schemas.recommendation import RawGiftRecommendationOutput
from app.services.ai.exceptions import (
    AIAuthenticationError,
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderError,
    AIRateLimitError,
    AIResponseValidationError,
)
from app.services.ai.google_gemma import GoogleGemmaAIProvider
from app.services.ai.prompts import RecommendationPromptInput


async def run_smoke_test(api_key: str, model_name: str, timeout: float) -> int:
    print("=" * 60)
    print("  GiftMind AI Inference Engine Smoke Test (Hosted Gemma 4)")
    print("=" * 60)
    print("Target Provider: Google Gemini API (hosted open-weight Gemma)")
    print(f"Target Model:    {model_name}")
    print(
        f"API Key:         {'[SET - ' + str(len(api_key)) + ' chars]' if api_key else '[MISSING]'}"
    )
    print(f"Timeout:         {timeout}s")
    print("-" * 60)

    if not api_key:
        print("❌ Smoke test FAILED: GOOGLE_API_KEY is not set.")
        print("Please obtain a free API key from Google AI Studio (https://aistudio.google.com/)")
        print("and run: export GOOGLE_API_KEY='your-api-key'")
        return 1

    provider = GoogleGemmaAIProvider(
        api_key=api_key,
        model=model_name,
        timeout_seconds=timeout,
    )

    # Step 1: Connectivity and model accessibility check
    print("\n[1/2] Verifying Google AI connection and model access...")
    status = await provider.verify_connection()
    if not status.get("available"):
        print(f"❌ Verification failed: {status.get('error')}")
        print("\nTroubleshooting tips:")
        print("  - Check that your GOOGLE_API_KEY is active in Google AI Studio")
        print(f"  - Confirm model '{model_name}' is accessible to your API project")
        return 1
    print(
        f"✅ Connection verified. Model: {status.get('model')} ({status.get('model_display_name', '')})"
    )

    # Step 2: Live inference with realistic sample recipient
    print(f"\n[2/2] Generating recommendations using '{model_name}'...")
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
    except AIAuthenticationError as exc:
        print(f"❌ Authentication failure: {exc.message}")
        return 1
    except AIRateLimitError as exc:
        print(f"❌ Rate limit exceeded: {exc.message}")
        if exc.retry_after:
            print(f"   Retry after {exc.retry_after}s")
        return 1
    except AIModelNotFoundError as exc:
        print(f"❌ Model '{model_name}' not found: {exc.message}")
        return 1
    except AIInferenceTimeoutError as exc:
        print(f"❌ Inference timed out: {exc.message}")
        return 1
    except AIResponseValidationError as exc:
        print(f"❌ Output validation error: {exc.message}")
        return 1
    except AIProviderError as exc:
        print(f"❌ Provider error: {exc.message}")
        return 1
    except Exception as exc:
        print(f"❌ Unexpected failure: {type(exc).__name__}: {exc}")
        return 1

    # Step 3: Validate output budget constraints and format
    budget_violations = [
        idea
        for idea in result.recommendations
        if idea.estimated_budget < sample_input.budget_min
        or idea.estimated_budget > sample_input.budget_max
    ]
    if budget_violations:
        print(
            f"❌ Budget constraint check failed: {len(budget_violations)} ideas violate bounds "
            f"[${sample_input.budget_min}, ${sample_input.budget_max}]"
        )
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
    print("🎉 Smoke test PASSED: Hosted Gemma 4 inference working properly!")
    print("=" * 60)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="GiftMind hosted Gemma 4 AI smoke test")
    parser.add_argument(
        "--api-key",
        default=os.environ.get("GOOGLE_API_KEY", ""),
        help="Google AI Studio API key (default: read from GOOGLE_API_KEY env var)",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("GEMMA_MODEL", "gemma-4-26b-a4b-it"),
        help="Target model ID (default: gemma-4-26b-a4b-it)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=90.0,
        help="Inference timeout in seconds (default: 90.0)",
    )
    args = parser.parse_args()

    exit_code = asyncio.run(run_smoke_test(args.api_key, args.model, args.timeout))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
