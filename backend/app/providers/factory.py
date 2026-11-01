"""Provider factory."""
from __future__ import annotations

from .base import BaseProvider
from .meta import MetaProvider
from .mock import MockProvider


def get_provider(name: str) -> BaseProvider:
    if name == "meta":
        return MetaProvider()
    return MockProvider()
