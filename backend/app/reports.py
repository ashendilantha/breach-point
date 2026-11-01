"""Report generator: JSON and Markdown security test reports."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from . import metrics
from .models import Agent, RunEvent, Scenario, TestRun


def build_report(db: Session, run_ids: list[int]) -> dict[str, Any]:
    runs = db.query(TestRun).filter(TestRun.id.in_(run_ids)).order_by(TestRun.id).all() if run_ids else []
    agents = {a.id: a for a in db.query(Agent).all()}
    scenarios = {s.id: s for s in db.query(Scenario).all()}
    summary = metrics.summarize(db)

    run_entries = []
    for r in runs:
        evs = db.query(RunEvent).filter(RunEvent.run_id == r.id).order_by(RunEvent.seq).all()
        run_entries.append({
            "run_id": r.id,
            "agent": agents.get(r.agent_id).name if r.agent_id in agents else "?",
            "scenario": r.scenario_id,
            "mode": r.mode,
            "status": r.status,
            "provider": r.provider,
            "model": r.model,
            "policy_version": r.policy_version,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "verification": r.verification,
            "error": r.error,
            "events": [
                {"seq": e.seq, "ts": e.ts.isoformat() if e.ts else None, "type": e.type,
                 "actor": e.actor, "tool": e.tool, "decision": e.decision,
                 "result_summary": e.result_summary, "explanation": e.explanation,
                 "evidence_ref": e.evidence_ref}
                for e in evs
            ],
        })

    providers_used = sorted({r.provider for r in runs}) or ["mock"]
    attacked = sum(1 for r in runs if (r.verification or {}).get("overall") == "attack_succeeded")
    blocked = sum(1 for r in runs if (r.verification or {}).get("overall") == "attack_blocked")
    inconc = sum(1 for r in runs if (r.verification or {}).get("overall") == "inconclusive")

    return {
        "title": "BREACH//POINT Security Test Report",
        "environment": {"providers": providers_used,
                        "mock_label": "Results from the 'mock' provider are deterministic simulations, not real model behavior."},
        "agents": [{"id": a.id, "name": a.name, "task": a.task, "provider": a.provider,
                    "model": a.model, "tools_enabled": a.tools_enabled}
                   for a in (agents[r.agent_id] for r in runs if r.agent_id in agents)],
        "scenarios": [{"id": s, **({k: getattr(scenarios[s], k) for k in
                                    ("name", "category", "difficulty", "user_task", "severity", "status")}
                                   if s in scenarios else {})} for s in {r.scenario_id for r in runs}],
        "methodology": ("Each scenario runs a target agent against synthetic untrusted content. Every proposed tool call "
                        "passes through the authorization firewall before execution. Outcomes are determined by the "
                        "independent verification engine from persisted execution events, never from model claims."),
        "results": {"runs": len(runs), "attack_succeeded": attacked, "attack_blocked": blocked,
                    "inconclusive": inconc},
        "metrics": summary,
        "run_details": run_entries,
        "weaknesses": [f"Run {r.id} ({r.scenario_id}, {r.mode}): {(r.verification or {}).get('explanation', '')}"
                       for r in runs if (r.verification or {}).get("overall") == "attack_succeeded"],
        "recommendations": ["Deny high-risk tools explicitly per agent and rerun attack + benign scenarios to validate."],
        "limitations": ["Synthetic tools and mailbox only.", "Mock provider simulates a naive agent; real-model behavior may differ.",
                        "Small samples: treat rates as indicative."],
        "reproduction": ("Reset DB (POST /api/demo/reset), rerun the same agent+scenario+mode via POST /api/runs, "
                         "compare verification.overall and evidence_refs."),
    }


def to_markdown(report: dict[str, Any]) -> str:
    m = report["metrics"]
    lines = [
        "# BREACH//POINT Security Test Report", "",
        "## 1. Executive summary",
        f"Runs: {report['results']['runs']} | Attack succeeded: {report['results']['attack_succeeded']} | "
        f"Blocked: {report['results']['attack_blocked']} | Inconclusive: {report['results']['inconclusive']}", "",
        "## 2. Test environment",
        f"Providers: {', '.join(report['environment']['providers'])}. {report['environment']['mock_label']}", "",
        "## 3. Agent configuration",
    ]
    for a in report["agents"]:
        lines.append(f"- {a['name']}: task='{a['task']}' provider={a['provider']} tools={', '.join(a['tools_enabled'])}")
    lines += ["", "## 4. Scenario descriptions"]
    for s in report["scenarios"]:
        lines.append(f"- {s.get('id')}: {s.get('name', '')} [{s.get('category', '')}, {s.get('severity', '')}]")
    lines += ["", "## 5. Test methodology", report["methodology"], "", "## 6. Results"]
    for r in report["run_details"]:
        v = r["verification"] or {}
        lines += [f"### Run {r['run_id']} — {r['scenario']} ({r['mode']}, {r['provider']})",
                  f"- Overall: {v.get('overall')} | objective={v.get('objective_achieved')} "
                  f"unauthorized={v.get('unauthorized_executed')} legitimate={v.get('legitimate_completed')}",
                  f"- Explanation: {v.get('explanation', '')}"]
    def row(name: str, key: str) -> str:
        mm = m[key]
        val = "n/a" if mm["value"] is None else f"{mm['value']:.1%}"
        return f"- {name}: {val} ({mm['numerator']}/{mm['denominator']}, inconclusive={mm['inconclusive']}). {mm['explanation']}"
    lines += ["", "## 7–11. Metrics",
              row("Attack success rate", "attack_success_rate"),
              row("Unauthorized action rate", "unauthorized_action_rate"),
              row("Blocking rate", "blocking_rate"),
              row("False-positive rate", "false_positive_rate"),
              row("Legitimate task completion rate", "legitimate_task_completion_rate"), "",
              "## 12. Inconclusive results",
              f"{report['results']['inconclusive']} inconclusive run(s). Excluded from rate denominators.", "",
              "## 13. Evidence references"]
    for r in report["run_details"]:
        for ref in (r["verification"] or {}).get("evidence_refs", [])[:10]:
            lines.append(f"- run {r['run_id']}: {ref}")
    lines += ["", "## 14. Identified weaknesses"]
    lines += [f"- {w}" for w in report["weaknesses"]] or ["- None in this report scope."]
    lines += ["", "## 15. Recommended improvements"]
    lines += [f"- {x}" for x in report["recommendations"]]
    lines += ["", "## 16. Verification limitations"]
    lines += [f"- {x}" for x in report["limitations"]]
    lines += ["", "## 17. Reproduction instructions", report["reproduction"], ""]
    return "\n".join(lines)
