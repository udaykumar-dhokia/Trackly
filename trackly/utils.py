from typing import Dict, Any

_NAMESPACE_MAP: list[tuple[str, str]] = [
    ("langchain_groq",          "groq"),
    ("langchain_anthropic",     "anthropic"),
    ("langchain_openai",        "openai"),
    ("langchain_google_genai",  "google"),
    ("langchain_google_vertexai","google"),
    ("langchain_ollama",        "ollama"),
    ("langchain_mistralai",     "mistral"),
    ("langchain_cohere",        "cohere"),
    ("langchain_together",      "together"),
    ("langchain_fireworks",     "fireworks"),
    ("langchain_aws",           "aws-bedrock"),
    ("openai",                  "openai"),
    ("anthropic",               "anthropic"),
    ("google",                  "google"),
]

_MODEL_NAME_MAP: list[tuple[str, str]] = [
    ("claude",   "anthropic"),
    ("gemini",   "google"),
    ("command",  "cohere"),
    ("mistral",  "mistral"),
    ("mixtral",  "mistral"),
    ("gpt-",     "openai"),
    ("o1-",      "openai"),
    ("o3-",      "openai"),
    ("o4-",      "openai"),
]

def _detect_provider(serialized: Dict[str, Any], model: str) -> str:
    """Return the canonical provider string using the two-layer strategy."""
    lc_id = serialized.get("id", [])
    if lc_id:
        joined = " ".join(str(part).lower() for part in lc_id)
        for needle, provider in _NAMESPACE_MAP:
            if needle in joined:
                return provider

    model_lower = model.lower()
    for needle, provider in _MODEL_NAME_MAP:
        if needle in model_lower:
            return provider

    return "unknown"
