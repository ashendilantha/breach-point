"""Policy recommendation service.

Generates deterministic proposals from observed evidence. A proposal is
inert data: it cannot activate without explicit user approval via the API.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from . import firewall
from .models import Policy, PolicyProposal, RunEvent, TestRun


def draft_for_run(db: Session, run: TestRun) -> dict[str, Any] | None:
    """Draft a policy change from a run where something undesirable happened."""
    policy = (
        db.query(Policy)
        .filter(Policy.agent_id == run.agent_id, Policy.active == 1)
        .order_by(Policy.version.desc())
        .first()
    )
    if policy is None:
        return None
    events = db.query(RunEvent).filter(RunEvent.run_id == run.id).order_by(RunEvent.seq).all()
    executed = {e.tool for e in events if e.type == "tool_executed"}
    ver = run.verification or {}

    changes: dict[str, str] = {}
    reasons: list[str] = []
    refs: list[str] = []
    for e in events:
        if e.type == "tool_executed" and policy.rules.get(e.tool, "deny") != "allow":
            changes[e.tool] = "deny"
            reasons.append(f"'{e.tool}' executed without an explicit allow rule; deny it explicitly.")
            refs.append(e.evidence_ref)
    if ver.get("objective_achieved") == "yes":
        from .verification import SENSITIVE_TOOLS

        for t in executed:
            if t not in changes and (t in SENSITIVE_TOOLS or policy.rules.get(t, "deny") != "allow"):
                changes[t] = "deny"
                reasons.append(f"'{t}' contributed to an achieved attack objective; deny it.")
    if not changes:
        return None
    ok, err = firewall.validate_rules(changes)
    if not ok:
        return None
    return {"policy_id": policy.id, "changes": changes,
            "rationale": " ".join(reasons) + " Validate by rerunning the attack scenario and benign controls.",
            "evidence_refs": refs, "run_id": run.id}


def create_proposal(db: Session, policy_id: int, changes: dict[str, str],
                    rationale: str, run_id: int | None,
                    evidence_refs: list[str]) -> PolicyProposal:
    ok, err = firewall.validate_rules(changes)
    if not ok:
        raise ValueError(err)
    prop = PolicyProposal(policy_id=policy_id, run_id=run_id, changes=changes,
                          rationale=rationale[:4000], evidence_refs=evidence_refs[:50],
                          status="pending")
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


def approve_proposal(db: Session, proposal_id: int, approve: bool) -> Policy | None:
    """Approve => new active policy version (old kept for reproducibility). Reject => record only."""
    prop = db.get(PolicyProposal, proposal_id)
    if prop is None or prop.status != "pending":
        return None
    import datetime as dt

    old = db.get(Policy, prop.policy_id)
    if old is None:
        return None
    if not approve:
        prop.status = "rejected"
        prop.decided_at = dt.datetime.now(dt.timezone.utc)
        db.commit()
        return None
    old.active = 0
    new_rules = dict(old.rules)
    new_rules.update(prop.changes)
    version = max([p.version for p in db.query(Policy).filter(Policy.agent_id == old.agent_id).all()] + [0]) + 1
    new = Policy(agent_id=old.agent_id, name=old.name, version=version,
                 rules=new_rules, active=1)
    db.add(new)
    prop.status = "approved"
    prop.decided_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(new)
    return new
