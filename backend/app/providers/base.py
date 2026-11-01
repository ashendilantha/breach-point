"""Model provider abstraction."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ProposedAction:
    tool: str
    args: dict[str, Any] = field(default_factory=dict)
    reasoning: str = ""


@dataclass
class ProviderResponse:
    text: str
    tool_calls: list[ProposedAction] = field(default_factory=list)
    model: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderCapabilities:
    tool_calling: bool = False
    structured_output: bool = False
    vision: bool = False


class ProviderError(Exception):
    pass


class BaseProvider:
    name: str = "base"

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities()

    def health_check(self) -> dict[str, Any]:
        raise NotImplementedError

    def generate_response(
        self,
        *,
        system: str,
        user_task: str,
        untrusted_content: str,
        content_type: str,
        tool_history: list[dict[str, Any]],
        available_tools: list[str],
        step: int,
    ) -> ProviderResponse:
        raise NotImplementedError
