"""Agent orchestration: executes one scenario against one agent.

Separation preserved throughout: trusted config, user task, untrusted
content (with provenance), model response, proposed calls, auth decisions,
execution results, final response.
"""
from __future__ import annotations

import datetime as dt
import time
from typing import Any

from sqlalchemy.orm import Session

from . import firewall, tools
from .config import get_settings
from .models import Agent, Policy, RunEvent, Scenario, TestRun
from .providers.base import ProviderError
from .providers.factory import get_provider
from .verification import verify_run


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class EventLog:
    def __init__(self, db: Session, run_id: int):
        self.db = db
        self.run_id = run_id
        self.seq = 0

    def add(self, type: str, *, actor: str = "system", tool: str = "",
            decision: str = "", result_summary: str = "", explanation: str = "",
            data: dict[str, Any] | None = None) -> RunEvent:
        self.seq += 1
        ev = RunEvent(
            run_id=self.run_id, seq=self.seq, ts=_utcnow(), type=type, actor=actor,
            tool=tool, decision=decision, result_summary=result_summary[:2000],
            explanation=explanation[:2000],
            evidence_ref=f"run-{self.run_id}-ev-{self.seq:04d}",
            data=data or {},
        )
        self.db.add(ev)
        return ev


def get_active_policy(db: Session, agent_id: int) -> Policy | None:
    return (
        db.query(Policy)
        .filter(Policy.agent_id == agent_id, Policy.active == 1)
        .order_by(Policy.version.desc())
        .first()
    )


def execute_run(db: Session, run: TestRun) -> TestRun:
    settings = get_settings()
    agent = db.get(Agent, run.agent_id)
    scenario = db.get(Scenario, run.scenario_id)
    assert agent is not None and scenario is not None

    log = EventLog(db, run.id)
    run.status = "running"
    run.started_at = _utcnow()
    db.commit()

    policy = get_active_policy(db, agent.id)
    rules = dict(policy.rules) if policy else {}
    run.policy_version = policy.version if policy else None
    unprotected = run.mode == "unprotected"

    # Snapshot synthetic environment state before execution.
    effects_before = {"sent": len(tools.SENT_LOG), "exports": len(tools.EXPORT_LOG), "deletes": len(tools.DELETE_LOG)}
    tools.reset_effect_logs()

    log.add("run_started", actor="system",
            result_summary=f"Scenario '{scenario.id}' in {run.mode} mode (policy v{run.policy_version}).",
            explanation=f"Agent '{agent.name}' via provider '{run.provider}'.",
            data={"agent": agent.name, "scenario": scenario.id, "mode": run.mode,
                  "provider": run.provider, "policy_version": run.policy_version})
    log.add("untrusted_content_presented", actor="system",
            result_summary=f"Untrusted {scenario.content_type} content attached as data with provenance.",
            explanation="Content is untrusted third-party data, not instructions.",
            data={"content_type": scenario.content_type, "chars": len(scenario.untrusted_content)})

    provider = get_provider(run.provider)
    tool_history: list[dict[str, Any]] = []
    total_calls = 0
    final_text = ""
    deadline = time.monotonic() + settings.run_timeout_seconds

    try:
        for step in range(settings.max_agent_steps):
            if time.monotonic() > deadline:
                log.add("run_timeout", actor="system", result_summary="Run timeout exceeded.",
                        explanation=f"Deadline {settings.run_timeout_seconds}s reached; classifying from observed events.")
                run.status = "timeout"
                break
            try:
                resp = provider.generate_response(
                    system=agent.instructions or f"You are {agent.name}. {agent.task}",
                    user_task=scenario.user_task,
                    untrusted_content=scenario.untrusted_content,
                    content_type=scenario.content_type,
                    tool_history=tool_history,
                    available_tools=list(agent.tools_enabled or []),
                    step=step,
                )
            except ProviderError as exc:
                log.add("provider_error", actor="provider", result_summary="Provider failed.",
                        explanation=str(exc)[:1000])
                run.status = "error"
                run.error = str(exc)[:1000]
                break

            final_text = resp.text
            if resp.model:
                run.model = resp.model
            log.add("model_response", actor=f"model:{run.provider}",
                    result_summary=(resp.text[:300] or "(empty response)"),
                    explanation=f"Step {step}: model proposed {len(resp.tool_calls)} tool call(s).",
                    data={"step": step, "proposals": [{"tool": c.tool, "args": c.args} for c in resp.tool_calls]})

            if not resp.tool_calls:
                break  # agent finished without further actions

            for call in resp.tool_calls:
                total_calls += 1
                if total_calls > settings.max_tool_calls:
                    log.add("limit_reached", actor="system",
                            result_summary="Maximum tool calls exceeded; stopping.",
                            explanation=f"Limit is {settings.max_tool_calls} calls per run.")
                    run.status = "error"
                    run.error = "max tool calls exceeded"
                    break
                args = call.args if isinstance(call.args, dict) else {}
                log.add("tool_call_proposed", actor=f"model:{run.provider}", tool=call.tool,
                        result_summary=f"Proposed {call.tool}({', '.join(sorted(args))}).",
                        explanation=call.reasoning or "No reasoning supplied.",
                        data={"args": args})

                decision = firewall.authorize(
                    rules, call.tool, args,
                    tools_enabled=list(agent.tools_enabled or []),
                    unprotected=unprotected,
                )
                log.add("auth_decision", actor="firewall", tool=call.tool, decision=decision.decision,
                        result_summary=f"{decision.decision.upper()}: {call.tool}",
                        explanation=decision.reason, data={"allowed": decision.allowed})

                executed = False
                result: dict[str, Any] = {}
                if decision.allowed:
                    spec = tools.get_tool(call.tool)
                    assert spec is not None  # authorize() already validated registration
                    try:
                        result = spec.handler(dict(args))
                        executed = True
                        log.add("tool_executed", actor=f"tool:{call.tool}", tool=call.tool,
                                decision="executed",
                                result_summary=str(result)[:500],
                                explanation=f"Handler for '{call.tool}' executed after authorization.",
                                data={"result": result})
                    except tools.ToolValidationError as exc:
                        log.add("tool_error", actor=f"tool:{call.tool}", tool=call.tool,
                                decision="handler_rejected",
                                result_summary="Handler rejected arguments.",
                                explanation=str(exc)[:500])
                else:
                    log.add("tool_blocked", actor="firewall", tool=call.tool,
                            decision=decision.decision,
                            result_summary=f"Blocked {call.tool}; handler did not execute.",
                            explanation=decision.reason)
                tool_history.append({"tool": call.tool, "decision": decision.decision,
                                     "executed": executed, "result": result})
            else:
                continue
            break
        else:
            log.add("limit_reached", actor="system", result_summary="Maximum agent steps reached.",
                    explanation=f"Limit is {settings.max_agent_steps} steps per run.")

        if run.status == "running":
            run.status = "completed"
    except Exception as exc:  # noqa: BLE001 - preserve failed records
        run.status = "error"
        run.error = str(exc)[:1000]
        log.add("run_error", actor="system", result_summary="Unexpected runner error.",
                explanation=str(exc)[:1000])

    effects_after = {"sent": len(tools.SENT_LOG), "exports": len(tools.EXPORT_LOG), "deletes": len(tools.DELETE_LOG)}
    log.add("final_response", actor=f"model:{run.provider}",
            result_summary=(final_text[:300] or "(no final response)"),
            explanation="User-facing response recorded for inspection; it is not proof of outcome.",
            data={"effects_before": effects_before, "effects_after": effects_after})

    run.finished_at = _utcnow()
    db.commit()

    # Independent verification from persisted events (never the model's claims).
    events = db.query(RunEvent).filter(RunEvent.run_id == run.id).order_by(RunEvent.seq).all()
    run.verification = verify_run(scenario, events, run, rules)
    db.commit()
    return run
