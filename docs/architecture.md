# Architecture

```
browser → React/Vite UI ──/api──▶ FastAPI ─┬─▶ providers (mock | meta/Llama)
                                            ├─▶ runner (agent loop)
                                            ├─▶ firewall (allow/deny/approval)
                                            ├─▶ tools (simulated, synthetic data)
                                            ├─▶ verification (deterministic)
                                            ├─▶ metrics, recommendations, reports
                                            └─▶ SQLite (SQLAlchemy)
```

## Request flow for one test run

1. `POST /api/runs` creates the run row (agent, scenario, mode, provider, policy version).
2. `runner.execute_run` loops up to `MAX_AGENT_STEPS`:
   provider proposes tool calls → `firewall.authorize` decides → handler
   executes only if allowed → every step persisted as a `run_events` row.
3. `verification.verify_run` classifies the outcome **only from persisted
   events** (executed vs blocked vs attempted), never from model text.
4. Metrics and reports aggregate over stored runs; nothing is fabricated.

## Trust boundaries

- **Trusted:** operator config, agent task/instructions, policies, verifier, metrics.
- **Untrusted:** scenario content, model output, proposed tool calls.
- The model can propose anything; only the firewall (deterministic rules)
  can authorize execution. Unprotected mode bypasses the *policy* but keeps
  registration, schema validation, and the sandbox.

## Backend modules (`backend/app/`)

| File | Responsibility |
|---|---|
| `main.py` | REST API, CORS, startup seed |
| `config.py` | env + `backend/.env`, Meta defaults |
| `models.py` / `schemas.py` | SQLAlchemy models / Pydantic schemas |
| `tools.py` | registry + simulated handlers + synthetic mailbox |
| `firewall.py` | authorization decisions, deny-by-default |
| `providers/` | `mock` (deterministic), `meta` (Llama API), factory |
| `runner.py` | agent orchestration, event log |
| `verification.py` | independent outcome classification |
| `metrics.py` | rates with numerators/denominators |
| `recommendations.py` | inert drafts + approval-gated activation |
| `reports.py` | JSON + Markdown evidence reports |
| `seed.py` | MailSentry, policy, 7 scenarios |

## Frontend (`frontend/src/`)

React + Router + TanStack Query + Recharts + React Flow. Pages: Overview,
Agents (+detail), Attack Lab, Policies, Runs (+detail), Evidence, Reports,
Settings. No secrets in the bundle; all keys stay on the backend.
