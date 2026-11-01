"""Unit tests: policy evaluation, tools, validation, metrics, verification, reports."""
from app import firewall, metrics, reports, tools, verification
from app.models import Agent, RunEvent, Scenario, TestRun
from app.seed import MAILSENTRY_RULES


def test_policy_allow_and_deny():
    assert firewall.evaluate_policy(MAILSENTRY_RULES, "list_emails") == "allow"
    assert firewall.evaluate_policy(MAILSENTRY_RULES, "send_email") == "deny"


def test_policy_deny_by_default_unknown_tool():
    d = firewall.authorize(MAILSENTRY_RULES, "nope_not_a_tool", {})
    assert not d.allowed and d.decision == "invalid_tool"


def test_policy_decision_ignores_text_not_action():
    # Same text context is irrelevant: decision depends on action + rules.
    d1 = firewall.authorize({"send_email": "deny"}, "send_email",
                            {"to": "a@b.test", "subject": "s", "body": "b"})
    d2 = firewall.authorize({"send_email": "allow"}, "send_email",
                            {"to": "a@b.test", "subject": "s", "body": "b"})
    assert d1.decision == "deny" and d2.decision == "allow"


def test_tool_registry_complete():
    ids = {t.id for t in tools.list_tools()}
    for required in ("list_emails", "read_email", "summarize_email", "search_email",
                     "send_email", "export_private_data", "delete_email"):
        assert required in ids
    for spec in tools.list_tools():
        assert spec.description and spec.input_schema and spec.expected_result
        assert spec.risk in ("low", "medium", "high", "critical")


def test_arg_validation_rejects_malformed():
    spec = tools.get_tool("send_email")
    ok, _ = tools.validate_args(spec, {"to": "a"})
    assert not ok
    ok, _ = tools.validate_args(spec, "not-a-dict")
    assert not ok
    ok, _ = tools.validate_args(spec, {"to": "a", "subject": "s", "body": "b", "extra": 1})
    assert not ok


def test_handler_validates_own_args():
    import pytest
    with pytest.raises(tools.ToolValidationError):
        tools.get_tool("read_email").handler({"email_id": "nope"})
    with pytest.raises(tools.ToolValidationError):
        tools.get_tool("read_webpage").handler({"url": "https://evil.example/x"})


def test_send_email_is_simulation_only():
    tools.reset_effect_logs()
    out = tools.get_tool("send_email").handler({"to": "a@b.test", "subject": "s", "body": "b"})
    assert out["simulated"] is True
    assert len(tools.SENT_LOG) == 1


def test_metrics_zero_denominators(db_session):
    # fresh DB with no runs
    for r in db_session.query(TestRun).all():
        db_session.delete(r)
    db_session.commit()
    s = metrics.summarize(db_session)
    assert s["attack_success_rate"]["value"] is None
    assert s["attack_success_rate"]["denominator"] == 0
    assert s["totals"]["runs"] == 0


def test_verification_blocked_attack(db_session):
    scen = db_session.get(Scenario, "B-email-exfil")
    run = TestRun(agent_id=1, scenario_id=scen.id, mode="protected", status="completed",
                  provider="mock", config={}, verification={})
    evs = [
        RunEvent(run_id=0, seq=1, type="tool_call_proposed", actor="model", tool="send_email"),
        RunEvent(run_id=0, seq=2, type="auth_decision", actor="firewall", tool="send_email", decision="deny"),
        RunEvent(run_id=0, seq=3, type="tool_blocked", actor="firewall", tool="send_email", decision="deny"),
        RunEvent(run_id=0, seq=4, type="tool_executed", actor="tool", tool="list_emails"),
    ]
    v = verification.verify_run(scen, evs, run, dict(MAILSENTRY_RULES))
    assert v["overall"] == "attack_blocked"
    assert v["objective_achieved"] == "no"
    assert v["unauthorized_executed"] == "no"


def test_verification_inconclusive_on_crash(db_session):
    scen = db_session.get(Scenario, "B-email-exfil")
    run = TestRun(agent_id=1, scenario_id=scen.id, mode="protected", status="error",
                  provider="mock", config={}, verification={})
    v = verification.verify_run(scen, [], run, dict(MAILSENTRY_RULES))
    assert v["objective_achieved"] == "unknown"
    assert v["overall"] == "inconclusive"


def test_report_generation(db_session):
    rep = reports.build_report(db_session, [])
    assert "BREACH//POINT" in rep["title"]
    md = reports.to_markdown(rep)
    for section in ("Executive summary", "Metrics", "Reproduction", "limitations"):
        assert section in md
    assert "META_API_KEY" not in md
