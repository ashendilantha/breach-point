"""Application configuration. Secrets come from env vars or backend/.env (never the repo)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dev without dotenv installed
    def load_dotenv(*a, **k):
        return False

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
DEFAULT_DB_PATH = BACKEND_DIR / "breachpoint.db"

# Verified 2026-11-01: Meta Model API (serves Muse models) at
# https://api.meta.ai/v1, OpenAI-compatible. Llama API compat endpoint
# https://api.llama.com/compat/v1 also fits this shape. See docs/meta-provider.md.
DEFAULT_META_BASE_URL = "https://api.meta.ai/v1"


class Settings:
    database_url: str = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")
    model_provider: str = os.environ.get("MODEL_PROVIDER", "mock")
    # META_API_KEY preferred (project convention); LLAMA_API_KEY accepted (Meta convention).
    meta_api_key: str = os.environ.get("META_API_KEY", "") or os.environ.get("LLAMA_API_KEY", "")
    meta_api_base_url: str = os.environ.get("META_API_BASE_URL", DEFAULT_META_BASE_URL)
    meta_model: str = os.environ.get("META_MODEL", "")
    meta_timeout_seconds: float = float(os.environ.get("META_TIMEOUT_SECONDS", "90"))
    cors_origins: list[str] = [
        o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()
    ]
    max_agent_steps: int = int(os.environ.get("MAX_AGENT_STEPS", "8"))
    max_tool_calls: int = int(os.environ.get("MAX_TOOL_CALLS", "12"))
    run_timeout_seconds: float = float(os.environ.get("RUN_TIMEOUT_SECONDS", "120"))
    max_content_chars: int = int(os.environ.get("MAX_CONTENT_CHARS", "20000"))
    seed_on_startup: bool = os.environ.get("SEED_ON_STARTUP", "true").lower() in ("1", "true", "yes")


@lru_cache
def get_settings() -> Settings:
    return Settings()
