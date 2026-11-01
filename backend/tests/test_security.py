"""12 security regression tests (spec section 21)."""
from app import firewall, recommendations, runner, tools
from app.models import Agent, Policy, RunEvent, Scenario, TestRun
from app.seed import MAILSENTRY_RULES


def _run(db, scenario_id, mode="protected", provider="mock"):
    agent = db.query(Agent).filter(Agent.name == "MailSentry").first()
    run = TestRun(agent_id=agent.id, scenario_id=scenario_id, mode=mode,
                  status="running", provider=provider, config={}, verification={})
    db.add(run)
    db.commit()
    db.refresh(run)
    return runner.execute_run(db, run)


def _events(db, run):
    return db.query(RunEvent).filter(RunEvent.run_id == run.id).order_by(RunEvent.seq).all()


def test_01_authorized_read_executes(db_session):
    run = _run(db_session, "E-benign-email")
    executed = {e.tool for e in _events(db_session, run) if e.type == "tool_executed"}
    assert "list_emails" in executed


def test_02_unauthorized_send_denied(db_session):
    run = _run(db_session, "B-email-exfil")
    denied = {e.tool for e in _events(db_session, run) if e.type == "tool_blocked"}
    assert "send_email" in denied
    assert run.verification["overall"] == "attack_blocked"


def test_03_denied_action_handler_never_executes(db_session):
    tools.reset_effect_logs()
    _run(db_session, "B-email-exfil")
    assert tools.SENT_LOG == []


def test_04_unknown_tool_denied(db_session):
    run = _run(db_session, "F-unknown-tool")
    evs = _events(db_session, run)
    decisions = [e for e in evs if e.tool == "fetch_admin_console" and e.type == "auth_decision"]
    assert decisions and all(d.decision == "invalid_tool" for d in decisions)
    assert not [e for e in evs if e.type == "tool_executed" and e.tool == "fetch_admin_console"]
    assert run.verification["objective_achieved"] == "no"


def test_05_untrusted_content_cannot_change_policy(db_session):
    agent = db_session.query(Agent).filter(Agent.name == "MailSentry").first()
    before = dict(db_session.query(Policy).filter(Policy.agent_id == agent.id, Policy.active == 1).one().rules)
    _run(db_session, "D-doc-privilege")  # doc claims to grant export rights
    after = dict(db_session.query(Policy).filter(Policy.agent_id == agent.id, Policy.active == 1).one().rules)
    assert before == after
    assert after["export_private_data"] == "deny"


def test_06_malformed_tool_call_rejected(db_session):
    d = firewall.authorize(dict(MAILSENTRY_RULES), "send_email", {"to": "x"})
    assert not d.allowed and d.decision == "invalid_args"
    d = firewall.authorize(dict(MAILSENTRY_RULES), "send_email", "junk")
    assert not d.allowed


def test_07_benign_task_completes(db_session):
    run = _run(db_session, "E-benign-email")
    assert run.verification["overall"] == "benign_pass"
    assert run.verification["legitimate_completed"] == "yes"


def test_08_inconclusive_not_counted_as_defense(db_session):
    from app import metrics
    agent = db_session.query(Agent).filter(Agent.name == "MailSentry").first()
    run = TestRun(agent_id=agent.id, scenario_id="B-email-exfil", mode="protected",
                  status="error", provider="mock", config={},
                  verification={"overall": "inconclusive", "objective_achieved": "unknown",
                                "unauthorized_executed": "unknown", "legitimate_completed": "unknown",
                                "control_behavior_ok": "unknown"})
    db_session.add(run)
    db_session.commit()
    s = metrics.summarize(db_session)
    assert s["attack_success_rate"]["inconclusive"] == 1
    assert s["attack_success_rate"]["denominator"] == 0


def test_09_audit_distinguishes_attempted_vs_executed(db_session):
    run = _run(db_session, "B-email-exfil")
    evs = _events(db_session, run)
    assert any(e.type == "tool_call_proposed" and e.tool == "send_email" for e in evs)
    assert any(e.type == "tool_blocked" and e.tool == "send_email" for e in evs)
    assert not any(e.type == "tool_executed" and e.tool == "send_email" for e in evs)


def test_10_replay_records_config(client):
    r1 = client.post("/api/runs", json={"agent_id": 1, "scenario_id": "E-benign-email", "mode": "protected"})
    assert r1.status_code == 201
    rid = r1.json()["id"]
    r2 = client.post(f"/api/runs/{rid}/replay")
    assert r2.status_code == 201
    assert r2.json()["config"]["replay_of"] == rid
    assert r2.json()["scenario_id"] == "E-benign-email"


def test_11_proposal_cannot_self_activate(db_session):
    agent = db_session.query(Agent).filter(Agent.name == "MailSentry").first()
    policy = db_session.query(Policy).filter(Policy.agent_id == agent.id, Policy.active == 1).one()
    prop = recommendations.create_proposal(db_session, policy.id, {"send_email": "allow"},
                                           "AI draft", None, [])
    assert prop.status == "pending"
    active = db_session.query(Policy).filter(Policy.agent_id == agent.id, Policy.active == 1).one()
    assert active.rules["send_email"] == "deny"  # unchanged until approval
    new = recommendations.approve_proposal(db_session, prop.id, True)
    assert new.rules["send_email"] == "allow" and new.version == policy.version + 1


def test_12_mock_provider_no_api_key(client, monkeypatch):
    monkeypatch.delenv("META_API_KEY", raising=False)
    r = client.post("/api/runs", json={"agent_id": 1, "scenario_id": "E-benign-email", "mode": "protected"})
    assert r.status_code == 201
    assert r.json()["provider"] == "mock"
    assert r.json()["status"] == "completed"
