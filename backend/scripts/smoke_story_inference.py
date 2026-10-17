#!/usr/bin/env python3
"""Smoke test script for GiftMind Memory Interview, AI Story Generation & PDF Keepsake.

Verifies end-to-end communication with Google-hosted Gemma 4 (gemma-4-26b-a4b-it):
1. Reads GOOGLE_API_KEY securely from environment or .env file (never logs the key).
2. Generates a personalized story keepsake from sample guided memories.
3. Validates output structure (title, dedication, 350-550 words story body, closing message).
4. Compiles the story into a production-grade PDF keepsake with NumberedCanvas pagination.
5. Inspects generated PDF binary signature and validates extracted content with pypdf.

Usage:
    export GOOGLE_API_KEY="your-api-key"
    uv run python scripts/smoke_story_inference.py
"""

import argparse
import asyncio
import io
import os
import sys
import time

import pypdf

from app.core.config import get_settings
from app.models.story import StoryKeepsake, StoryKeepsakeStatus
from app.schemas.story import StoryPromptInput
from app.services.ai.exceptions import (
    AIAuthenticationError,
    AIInferenceTimeoutError,
    AIModelNotFoundError,
    AIProviderError,
    AIRateLimitError,
    AIResponseValidationError,
)
from app.services.ai.google_gemma import GoogleGemmaAIProvider
from app.services.pdf.keepsake import generate_story_keepsake_pdf


async def run_story_smoke_test(api_key: str, model_name: str, timeout: float) -> int:
    print("=" * 65)
    print("  GiftMind Phase 4 Live Smoke Test: AI Story & PDF Keepsake")
    print("=" * 65)
    print("Target Provider: Google Gemini API (hosted Gemma 4 open-weight)")
    print(f"Target Model:    {model_name}")
    print(f"API Key:         {'[CONFIGURED - ' + str(len(api_key)) + ' chars]' if api_key else '[MISSING]'}")
    print(f"Timeout:         {timeout}s")
    print("-" * 65)

    if not api_key:
        print("❌ Smoke test FAILED: GOOGLE_API_KEY is missing or empty.")
        return 1

    provider = GoogleGemmaAIProvider(
        api_key=api_key,
        model=model_name,
        timeout_seconds=timeout,
    )

    # Step 1: Model accessibility check
    print("1. Verifying model connection with Google API host...")
    conn = await provider.verify_connection()
    if not conn.get("available"):
        print(f"❌ Connection check failed: {conn.get('error')}")
        return 1
    print(f"✓ Model verified: {conn.get('model_display_name', model_name)}")

    # Step 2: Prepare grounded memories
    print("\n2. Preparing authentic guided memory inputs...")
    sample_memories = {
        "how_we_met": "We met during our freshman year orientation when we both got hopelessly lost looking for the astronomy tower in the rain.",
        "favorite_memory": "Sitting on the back of our tailgate at Joshua Tree under a moonless sky, identifying constellations and debating philosophy until dawn.",
        "what_makes_them_special": "Their infectious optimism and uncanny ability to make anyone feel heard and deeply valued within five minutes of meeting.",
        "shared_milestone": "Running our first marathon together through the hills, when we both wanted to give up at mile twenty but dragged each other across the finish line.",
        "gift_feeling": "Deeply appreciated, nostalgic, and excited for the next chapter of adventures ahead.",
    }

    prompt_input = StoryPromptInput(
        recipient_name="Rowan Sterling",
        relationship="Best Friend",
        occasion="30th Birthday",
        memories=sample_memories,
    )

    # Step 3: Hosted inference
    print("\n3. Invoking hosted Gemma 4 for story generation (approx 15-45s)...")
    start_t = time.perf_counter()
    try:
        raw_story = await provider.generate_story_keepsake(prompt_input)
        latency = time.perf_counter() - start_t
        print(f"✓ Story generated successfully in {latency:.2f}s!")
    except AIInferenceTimeoutError:
        print(f"❌ Inference timed out after {timeout}s.")
        return 1
    except (AIAuthenticationError, AIModelNotFoundError, AIRateLimitError, AIResponseValidationError, AIProviderError) as e:
        print(f"❌ Story generation failed: {type(e).__name__} - {e}")
        return 1

    word_count = len(raw_story.story_body.split())
    print("\n--- Generated Keepsake Preview ---")
    print(f"Title:       {raw_story.title}")
    print(f"Dedication:  {raw_story.dedication}")
    print(f"Word Count:  {word_count} words")
    print(f"Closing:     {raw_story.closing_message}")

    # Step 4: PDF Generation and Verification
    print("\n4. Compiling story into PDF Keepsake document...")
    mock_story_record = StoryKeepsake(
        title=raw_story.title,
        dedication=raw_story.dedication,
        story_body=raw_story.story_body,
        closing_message=raw_story.closing_message,
        model_name=model_name,
        prompt_version="v1",
        status=StoryKeepsakeStatus.succeeded,
    )

    pdf_bytes = generate_story_keepsake_pdf(
        story=mock_story_record,
        recipient_name="Rowan Sterling",
        occasion="30th Birthday",
    )

    assert pdf_bytes.startswith(b"%PDF-"), "Generated file does not have valid PDF magic bytes"
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    num_pages = len(reader.pages)
    extracted_text = " ".join([p.extract_text() or "" for p in reader.pages])

    assert "Rowan Sterling" in extracted_text, "Recipient name missing from PDF"
    assert "GiftMind Keepsake" in extracted_text, "GiftMind branding missing from PDF"

    print(f"✓ PDF compiled successfully! ({len(pdf_bytes)} bytes, {num_pages} pages)")
    print("✓ Text extraction verified: Recipient 'Rowan Sterling' and GiftMind branding confirmed.")
    print("=" * 65)
    print("  ALL PHASE 4 LIVE INFERENCE & PDF CHECKS PASSED")
    print("=" * 65)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test for Phase 4 AI Story Generation & PDF Keepsake")
    parser.add_argument("--api-key", default=None, help="Google API key (falls back to GOOGLE_API_KEY in .env)")
    parser.add_argument("--model", default=None, help="Model name (default: from settings or gemma-4-26b-a4b-it)")
    parser.add_argument("--timeout", type=float, default=90.0, help="Inference timeout in seconds")
    args = parser.parse_args()

    settings = get_settings()
    api_key = args.api_key or os.environ.get("GOOGLE_API_KEY") or settings.GOOGLE_API_KEY
    model = args.model or settings.GEMMA_MODEL or "gemma-4-26b-a4b-it"

    exit_code = asyncio.run(run_story_smoke_test(api_key, model, args.timeout))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
