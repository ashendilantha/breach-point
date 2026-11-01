"""BREACH//POINT FastAPI application.

Single-user development mode: state-changing endpoints are intentionally
open for local demo use. Do NOT expose publicly without adding auth.
"""
from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from . import firewall, metrics, recommendations, reports, runner, seed
from .config import get_settings
from .database import SessionLocal, get_db, init_db
from .models import Agent, Policy, PolicyProposal, RunEvent, Scenario, TestRun, Tool
from .providers.factory import get_provider
from .schemas import (
    AgentCreate, AgentOut, AgentUpdate, EventOut, MetricsSummary, PolicyCreate,
    PolicyOut, ProposalCreate, ProposalOut, RunCreate, RunOut, ScenarioCreate,
    ScenarioOut, ToolOut,
)

settings = get_settings()

app = FastAPI(title="BREACH//POINT API", version="0.1.0",
              description="AI agent security testing: attack the agent, test the defense, prove the result.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    if settings.seed_on_startup:
        db = SessionLocal()
        try:
            seed.seed(db)
        finally:
            db.close()


# ---------------------------------------------------------------- health ---
@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": "breach-point"}


@app.get("/api/providers/health")
def providers_health() -> dict:
    return {"providers": [get_provider("mock").health_check(), get_provider("meta").health_check()]}


# ----------------------------------------------------------------- agents ---
def _agent_out(a: Agent) -> AgentOut:
    return AgentOut(id=a.id, name=a.name, task=a.task, instructions=a.instructions,
                    provider=a.provider, model=a.model, tools_enabled=list(a.tools_enabled or []),
                    created_at=a.created_at, updated_at=a.updated_at)


@app.get("/api/agents", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)):
    return [_agent_out(a) for a in db.query(Agent).order_by(Agent.id).all()]


@app.post("/api/agents", response_model=AgentOut, status_code=201)
def create_agent(body: AgentCreate, db: Session = Depends(get_db)):
    if db.query(Agent).filter(Agent.name == body.name).first():
        raise HTTPException(409, f"Agent '{body.name}' already exists.")
    from . import tools as toolreg
    for t in body.tools_enabled:
        if toolreg.get_tool(t) is None:
            raise HTTPException(400, f"Unknown tool '{t}'.")
    a = Agent(name=body.name, task=body.task, instructions=body.instructions,
              provider=body.provider, model=body.model, tools_enabled=list(body.tools_enabled))
    db.add(a)
    db.commit()
    db.refresh(a)
    return _agent_out(a)


@app.get("/api/agents/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    a = db.get(Agent, agent_id)
    if a is None:
        raise HTTPException(404, "Agent not found.")
    return _agent_out(a)


@app.patch("/api/agents/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: int, body: AgentUpdate, db: Session = Depends(get_db)):
    a = db.get(Agent, agent_id)
    if a is None:
        raise HTTPException(404, "Agent not found.")
    data = body.model_dump(exclude_unset=True)
    if "tools_enabled" in data and data["tools_enabled"] is not None:
        from . import tools as toolreg
        for t in data["tools_enabled"]:
            if toolreg.get_tool(t) is None:
                raise HTTPException(400, f"Unknown tool '{t}'.")
    for k, v in data.items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return _agent_out(a)


@app.get("/api/agents/{agent_id}/runs", response_model=list[RunOut])
def agent_runs(agent_id: int, db: Session = Depends(get_db)):
    return [_run_out(r) for r in db.query(TestRun).filter(TestRun.agent_id == agent_id)
            .order_by(TestRun.id.desc()).limit(50).all()]


# ------------------------------------------------------------------ tools ---
@app.get("/api/tools", response_model=list[ToolOut])
def list_tools(db: Session = Depends(get_db)):
    return [ToolOut(id=t.id, description=t.description, risk=t.risk,
                    default_permission=t.default_permission, input_schema=t.input_schema,
                    expected_result=t.expected_result)
            for t in db.query(Tool).order_by(Tool.id).all()]


# --------------------------------------------------------------- policies ---
def _policy_out(p: Policy) -> PolicyOut:
    return PolicyOut(id=p.id, agent_id=p.agent_id, name=p.name, version=p.version,
                     rules=dict(p.rules), active=bool(p.active), created_at=p.created_at)


@app.get("/api/policies", response_model=list[PolicyOut])
def list_policies(agent_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Policy)
    if agent_id is not None:
        q = q.filter(Policy.agent_id == agent_id)
    return [_policy_out(p) for p in q.order_by(Policy.agent_id, Policy.version).all()]


@app.post("/api/policies", response_model=PolicyOut, status_code=201)
def create_policy(body: PolicyCreate, db: Session = Depends(get_db)):
    if db.get(Agent, body.agent_id) is None:
        raise HTTPException(404, "Agent not found.")
    ok, err = firewall.validate_rules(body.rules)
    if not ok:
        raise HTTPException(400, err)
    for p in db.query(Policy).filter(Policy.agent_id == body.agent_id, Policy.active == 1).all():
        p.active = 0
    version = max([p.version for p in db.query(Policy).filter(Policy.agent_id == body.agent_id).all()] + [0]) + 1
    p = Policy(agent_id=body.agent_id, name=body.name, version=version, rules=dict(body.rules), active=1)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _policy_out(p)


@app.get("/api/proposals", response_model=list[ProposalOut])
def list_proposals(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(PolicyProposal)
    if status:
        q = q.filter(PolicyProposal.status == status)
    return [_proposal_out(p) for p in q.order_by(PolicyProposal.id.desc()).all()]


def _proposal_out(p: PolicyProposal) -> ProposalOut:
    return ProposalOut(id=p.id, policy_id=p.policy_id, run_id=p.run_id, changes=dict(p.changes),
                       rationale=p.rationale, evidence_refs=list(p.evidence_refs or []),
                       status=p.status, created_at=p.created_at, decided_at=p.decided_at)


@app.post("/api/policies/{policy_id}/proposals", response_model=ProposalOut, status_code=201)
def create_proposal(policy_id: int, body: ProposalCreate, db: Session = Depends(get_db)):
    if db.get(Policy, policy_id) is None:
        raise HTTPException(404, "Policy not found.")
    try:
        prop = recommendations.create_proposal(db, policy_id, body.changes, body.rationale,
                                               body.run_id, body.evidence_refs)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return _proposal_out(prop)


@app.post("/api/runs/{run_id}/draft-proposal", response_model=ProposalOut | None)
def draft_proposal(run_id: int, db: Session = Depends(get_db)):
    run = db.get(TestRun, run_id)
    if run is None:
        raise HTTPException(404, "Run not found.")
    draft = recommendations.draft_for_run(db, run)
    if draft is None:
        return None
    prop = recommendations.create_proposal(db, draft["policy_id"], draft["changes"],
                                           draft["rationale"], draft["run_id"], draft["evidence_refs"])
    return _proposal_out(prop)


@app.post("/api/proposals/{proposal_id}/approve", response_model=PolicyOut | None)
def approve_proposal(proposal_id: int, approve: bool = True, db: Session = Depends(get_db)):
    if db.get(PolicyProposal, proposal_id) is None:
        raise HTTPException(404, "Proposal not found.")
    new = recommendations.approve_proposal(db, proposal_id, approve)
    return _policy_out(new) if new else None


# Back-compat alias required by spec naming:
@app.post("/api/policies/{policy_id}/approve")
def approve_alias(policy_id: int, proposal_id: int, approve: bool = True, db: Session = Depends(get_db)):
    prop = db.get(PolicyProposal, proposal_id)
    if prop is None or prop.policy_id != policy_id:
        raise HTTPException(404, "Proposal not found for this policy.")
    new = recommendations.approve_proposal(db, proposal_id, approve)
    return {"approved": approve and new is not None,
            "policy": _policy_out(new).model_dump() if new else None}


# -------------------------------------------------------------- scenarios ---
@app.get("/api/scenarios", response_model=list[ScenarioOut])
def list_scenarios(category: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Scenario)
    if category:
        q = q.filter(Scenario.category == category)
    return [ScenarioOut(**{k: getattr(s, k) for k in ScenarioCreate.model_fields}) for s in q.order_by(Scenario.id).all()]


@app.post("/api/scenarios", response_model=ScenarioOut, status_code=201)
def create_scenario(body: ScenarioCreate, db: Session = Depends(get_db)):
    if db.get(Scenario, body.id) is not None:
        raise HTTPException(409, f"Scenario '{body.id}' already exists.")
    s = Scenario(**body.model_dump())
    db.add(s)
    db.commit()
    return body


# ------------------------------------------------------------------ runs ---
def _run_out(r: TestRun) -> RunOut:
    return RunOut(id=r.id, agent_id=r.agent_id, scenario_id=r.scenario_id, mode=r.mode,
                  status=r.status, provider=r.provider, model=r.model,
                  policy_version=r.policy_version, config=dict(r.config or {}),
                  verification=dict(r.verification or {}), error=r.error,
                  started_at=r.started_at, finished_at=r.finished_at)


@app.post("/api/runs", response_model=RunOut, status_code=201)
def create_run(body: RunCreate, db: Session = Depends(get_db)):
    agent = db.get(Agent, body.agent_id)
    if agent is None:
        raise HTTPException(404, "Agent not found.")
    scenario = db.get(Scenario, body.scenario_id)
    if scenario is None:
        raise HTTPException(404, "Scenario not found.")
    provider = body.provider or agent.provider or "mock"
    if provider == "meta":
        health = get_provider("meta").health_check()
        if health.get("status") != "ok":
            raise HTTPException(400, f"Meta provider unavailable: {health.get('note', health.get('status'))}")
    policy = runner.get_active_policy(db, agent.id)
    run = TestRun(agent_id=agent.id, scenario_id=scenario.id, mode=body.mode,
                  status="running", provider=provider, model="",
                  policy_version=policy.version if policy else None,
                  config={"agent_name": agent.name, "scenario": scenario.id,
                          "unprotected_warning": "intentionally vulnerable comparison config" if body.mode == "unprotected" else None,
                          "max_steps": settings.max_agent_steps, "max_tool_calls": settings.max_tool_calls})
    db.add(run)
    db.commit()
    db.refresh(run)
    runner.execute_run(db, run)
    db.refresh(run)
    return _run_out(run)


@app.get("/api/runs", response_model=list[RunOut])
def list_runs(agent_id: int | None = None, scenario_id: str | None = None,
              mode: str | None = None, limit: int = Query(50, le=200),
              db: Session = Depends(get_db)):
    q = db.query(TestRun)
    if agent_id is not None:
        q = q.filter(TestRun.agent_id == agent_id)
    if scenario_id is not None:
        q = q.filter(TestRun.scenario_id == scenario_id)
    if mode is not None:
        q = q.filter(TestRun.mode == mode)
    return [_run_out(r) for r in q.order_by(TestRun.id.desc()).limit(limit).all()]


@app.get("/api/runs/{run_id}", response_model=RunOut)
def get_run(run_id: int, db: Session = Depends(get_db)):
    r = db.get(TestRun, run_id)
    if r is None:
        raise HTTPException(404, "Run not found.")
    return _run_out(r)


@app.post("/api/runs/{run_id}/replay", response_model=RunOut, status_code=201)
def replay_run(run_id: int, db: Session = Depends(get_db)):
    orig = db.get(TestRun, run_id)
    if orig is None:
        raise HTTPException(404, "Run not found.")
    policy = runner.get_active_policy(db, orig.agent_id)
    run = TestRun(agent_id=orig.agent_id, scenario_id=orig.scenario_id, mode=orig.mode,
                  status="running", provider=orig.provider, model="",
                  policy_version=policy.version if policy else None,
                  config={**(orig.config or {}), "replay_of": orig.id})
    db.add(run)
    db.commit()
    db.refresh(run)
    runner.execute_run(db, run)
    db.refresh(run)
    return _run_out(run)


@app.get("/api/runs/{run_id}/events", response_model=list[EventOut])
def run_events(run_id: int, db: Session = Depends(get_db)):
    if db.get(TestRun, run_id) is None:
        raise HTTPException(404, "Run not found.")
    evs = db.query(RunEvent).filter(RunEvent.run_id == run_id).order_by(RunEvent.seq).all()
    return [EventOut(id=e.id, run_id=e.run_id, seq=e.seq, ts=e.ts, type=e.type, actor=e.actor,
                     tool=e.tool, decision=e.decision, result_summary=e.result_summary,
                     explanation=e.explanation, evidence_ref=e.evidence_ref, data=dict(e.data or {}))
            for e in evs]


@app.get("/api/runs/{run_id}/report")
def run_report(run_id: int, format: str = "json", db: Session = Depends(get_db)):
    if db.get(TestRun, run_id) is None:
        raise HTTPException(404, "Run not found.")
    report = reports.build_report(db, [run_id])
    if format == "markdown":
        return PlainTextResponse(reports.to_markdown(report))
    return report


@app.get("/api/reports/full")
def full_report(format: str = "json", limit: int = Query(100, le=500), db: Session = Depends(get_db)):
    ids = [r.id for r in db.query(TestRun).order_by(TestRun.id.desc()).limit(limit).all()]
    report = reports.build_report(db, ids)
    if format == "markdown":
        return PlainTextResponse(reports.to_markdown(report))
    return report


@app.get("/api/compare")
def compare_runs(a: int, b: int, db: Session = Depends(get_db)):
    ra, rb = db.get(TestRun, a), db.get(TestRun, b)
    if ra is None or rb is None:
        raise HTTPException(404, "Run not found.")
    comparable = (ra.agent_id == rb.agent_id and ra.scenario_id == rb.scenario_id
                  and ra.provider == rb.provider)
    return {"a": _run_out(ra), "b": _run_out(rb), "comparable": comparable,
            "note": None if comparable else "Runs differ in agent, scenario, or provider; treat comparison as indicative."}


# ---------------------------------------------------------------- metrics ---
@app.get("/api/metrics/summary", response_model=MetricsSummary)
def metrics_summary(mode: str | None = None, category: str | None = None,
                    provider: str | None = None, db: Session = Depends(get_db)):
    return metrics.summarize(db, mode=mode or None, category=category or None,
                             provider=provider or None)


@app.get("/api/events/recent")
def recent_events(limit: int = Query(20, le=100), db: Session = Depends(get_db)):
    evs = db.query(RunEvent).order_by(RunEvent.id.desc()).limit(limit).all()
    return [{"id": e.id, "run_id": e.run_id, "seq": e.seq, "ts": e.ts.isoformat() if e.ts else None,
             "type": e.type, "actor": e.actor, "tool": e.tool, "decision": e.decision,
             "result_summary": e.result_summary, "evidence_ref": e.evidence_ref} for e in evs]


# ------------------------------------------------------------------- demo ---
@app.post("/api/demo/reset")
def demo_reset(run_demo: bool = True, db: Session = Depends(get_db)):
    """Reset DB to seed state and optionally execute demo runs for evidence."""
    from .database import Base, engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    counts = seed.seed(db)
    run_ids: list[int] = []
    if run_demo:
        agent = db.query(Agent).filter(Agent.name == "MailSentry").first()
        pairs = [("B-email-exfil", "unprotected"), ("B-email-exfil", "protected"),
                 ("D-doc-privilege", "protected"), ("E-benign-email", "protected"),
                 ("F-unknown-tool", "protected")]
        for scen_id, mode in pairs:
            policy = runner.get_active_policy(db, agent.id)
            run = TestRun(agent_id=agent.id, scenario_id=scen_id, mode=mode,
                          status="running", provider="mock", model="",
                          policy_version=policy.version if policy else None,
                          config={"agent_name": agent.name, "demo": True})
            db.add(run)
            db.commit()
            db.refresh(run)
            runner.execute_run(db, run)
            run_ids.append(run.id)
    return {"seeded": counts, "demo_run_ids": run_ids,
            "note": "Demo evidence generated by actual execution with the deterministic mock provider."}
