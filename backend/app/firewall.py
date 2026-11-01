"""Runtime authorization firewall.

Every proposed tool call passes through `authorize()` before execution.
Decisions depend on the requested ACTION and its permissions, never on
keyword matching of surrounding text.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from . import tools

VALID_PERMISSIONS = ("allow", "deny", "approval")


@dataclass
class AuthDecision:
    allowed: bool
    decision: str  # allow|deny|approval_required|invalid_tool|invalid_args|not_enabled
    reason: str


def evaluate_policy(rules: dict[str, str], tool_id: str) -> str:
    """Resolve the effective permission for a tool. Deny by default."""
    perm = rules.get(tool_id)
    if perm in VALID_PERMISSIONS:
        return perm
    return "deny"


def authorize(
    rules: dict[str, str],
    tool_id: str,
    args: Any,
    *,
    tools_enabled: list[str] | None = None,
    unprotected: bool = False,
) -> AuthDecision:
    """Authorize one proposed tool call.

    Sequence: validate tool id -> validate schema -> resolve permissions ->
    evaluate policy -> resource checks -> decision. Never executes anything.
    """
    spec = tools.get_tool(tool_id)
    if spec is None:
        return AuthDecision(False, "invalid_tool", f"Unknown tool '{tool_id}'. Deny by default.")

    ok, err = tools.validate_args(spec, args)
    if not ok:
        return AuthDecision(False, "invalid_args", f"Invalid arguments for '{tool_id}': {err}.")

    if tools_enabled is not None and tool_id not in tools_enabled:
        return AuthDecision(False, "not_enabled", f"Tool '{tool_id}' is not enabled for this agent.")

    if unprotected:
        # Intentionally vulnerable comparison mode: registration, schema, and
        # sandbox constraints still apply; the protective policy is bypassed.
        return AuthDecision(True, "allow", "Unprotected baseline mode: policy bypassed (comparison only).")

    perm = evaluate_policy(rules, tool_id)
    if perm == "allow":
        return AuthDecision(True, "allow", f"Policy allows '{tool_id}'.")
    if perm == "approval":
        # MVP has no human-in-the-loop queue; approval-required tools are held
        # (blocked) and recorded as requiring approval.
        return AuthDecision(False, "approval_required", f"Tool '{tool_id}' requires approval; no approval granted.")
    return AuthDecision(False, "deny", f"Policy denies '{tool_id}'.")


def validate_rules(rules: dict[str, str]) -> tuple[bool, str]:
    for tool_id, perm in rules.items():
        if tools.get_tool(tool_id) is None:
            return False, f"Unknown tool '{tool_id}' in policy rules."
        if perm not in VALID_PERMISSIONS:
            return False, f"Invalid permission '{perm}' for tool '{tool_id}'."
    return True, ""
