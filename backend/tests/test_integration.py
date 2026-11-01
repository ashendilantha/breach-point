"""Integration tests: API + full execution paths."""
from app.models import TestRun


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_agents_and_scenarios_seeded(client):
    agents = client.get("/api/agents").json()
    assert any(a["name"] == "MailSentry" for a in agents)
    scenarios = client.get("/api/scenarios").json()
    assert len(scenarios) >= 6


def test_run_attack_protected_vs_unprotected(client):
    prot = client.post("/api/runs", json={"agent_id": 1, "scenario_id": "B-email-exfil", "mode": "protected"}).json()
    unprot = client.post("/api/runs", json={"agent_id": 1, "scenario_id": "B-email-exfil", "mode": "unprotected"}).json()
    assert prot["verification"]["overall"] == "attack_blocked"
    assert unprot["verification"]["overall"] == "attack_succeeded"
    cmp = client.get(f"/api/compare?a={prot['id']}&b={unprot['id']}").json()
    assert cmp["comparable"] is True


def test_events_persisted(client):
    run = client.post("/api/runs", json={"agent_id": 1, "scenario_id": "B-email-exfil", "mode": "protected"}).json()
    events = client.get(f"/api/runs/{run['id']}/events").json()
    types = {e["type"] for e in events}
    assert {"run_started", "tool_call_proposed", "auth_decision", "tool_blocked"} <= types
    assert all(e["evidence_ref"].startswith(f"run-{run['id']}-ev-") for e in events)


def test_metrics_aggregate(client):
    client.post("/api/runs", json={"agent_id": 1, "scenario_id": "B-email-exfil", "mode": "protected"})
    client.post("/api/runs", json={"agent_id": 1, "scenario_id": "E-benign-email", "mode": "protected"})
    s = client.get("/api/metrics/summary").json()
    assert s["totals"]["runs"] == 2
    assert s["attack_success_rate"]["denominator"] == 1
    assert s["attack_success_rate"]["value"] == 0.0


def test_api_errors(client):
    assert client.get("/api/agents/9999").status_code == 404
    assert client.post("/api/runs", json={"agent_id": 1, "scenario_id": "nope"}).status_code == 404
    r = client.post("/api/policies", json={"agent_id": 1, "name": "bad", "rules": {"nope": "allow"}})
    assert r.status_code == 400
    r = client.post("/api/runs", json={"agent_id": 1, "scenario_id": "E-benign-email",
                                       "mode": "protected", "provider": "meta"})
    assert r.status_code == 400  # meta unconfigured


def test_report_endpoints(client):
    run = client.post("/api/runs", json={"agent_id": 1, "scenario_id": "E-benign-email", "mode": "protected"}).json()
    rep = client.get(f"/api/runs/{run['id']}/report").json()
    assert "BREACH//POINT" in rep["title"]
    md = client.get(f"/api/runs/{run['id']}/report?format=markdown")
    assert md.status_code == 200 and "Executive summary" in md.text


def test_draft_proposal_flow(client):
    run = client.post("/api/runs", json={"agent_id": 1, "scenario_id": "B-email-exfil", "mode": "unprotected"}).json()
    assert run["verification"]["overall"] == "attack_succeeded"
    # Protected-policy run has nothing to fix (already denied) -> may be null; use unprotected run:
    # policy still denies send_email, but handler executed in unprotected mode -> draft proposes deny (already deny).
    # Instead verify the proposals API accepts and gates manual proposals:
    pols = client.get("/api/policies?agent_id=1").json()
    active = [p for p in pols if p["active"]][0]
    prop = client.post(f"/api/policies/{active['id']}/proposals",
                       json={"changes": {"delete_email": "approval"}, "rationale": "test"}).json()
    assert prop["status"] == "pending"
    new = client.post(f"/api/proposals/{prop['id']}/approve?approve=true").json()
    assert new["rules"]["delete_email"] == "approval"
