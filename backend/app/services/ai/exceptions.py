class AIProviderError(Exception):
    """Base exception for all AI provider integration failures."""

    def __init__(self, message: str, is_retryable: bool = False) -> None:
        super().__init__(message)
        self.message = message
        self.is_retryable = is_retryable


class AIProviderUnavailableError(AIProviderError):
    """Raised when the AI provider server (e.g. Ollama) cannot be reached or connected to."""

    def __init__(
        self,
        message: str = "AI inference service is currently unavailable. Please verify that the AI service is running.",
    ) -> None:
        super().__init__(message, is_retryable=True)


class AIInferenceTimeoutError(AIProviderError):
    """Raised when the inference request exceeds the configured deadline."""

    def __init__(
        self,
        message: str = "AI inference request timed out. Please try again or reduce the prompt size.",
    ) -> None:
        super().__init__(message, is_retryable=True)


class AIModelNotFoundError(AIProviderError):
    """Raised when the requested model is not downloaded or available on the provider."""

    def __init__(self, model_name: str) -> None:
        super().__init__(
            f"The configured AI model '{model_name}' was not found on the inference host. Run 'ollama pull {model_name}' to install it.",
            is_retryable=False,
        )
        self.model_name = model_name


class AIResponseValidationError(AIProviderError):
    """Raised when the AI provider returns malformed JSON or output that fails domain schema validation."""

    def __init__(
        self,
        message: str = "The AI model produced an output format that could not be validated. Please try again.",
    ) -> None:
        super().__init__(message, is_retryable=True)


class AIAuthenticationError(AIProviderError):
    """Raised when the AI provider authentication fails (e.g. invalid or missing API key)."""

    def __init__(
        self,
        message: str = "AI service authentication failed. Please verify your API key.",
    ) -> None:
        super().__init__(message, is_retryable=False)


class AIRateLimitError(AIProviderError):
    """Raised when the AI provider rate limit / quota has been exceeded (HTTP 429)."""

    def __init__(
        self,
        message: str = "AI service rate limit exceeded. Please try again shortly.",
        retry_after: float | None = None,
    ) -> None:
        super().__init__(message, is_retryable=True)
        self.retry_after = retry_after
