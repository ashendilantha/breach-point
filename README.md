# BREACH//POINT

**Attack the Agent. Test the Defense. Prove the Result.**

AI agent security testing platform: controlled prompt-injection experiments, a runtime
tool-call authorization firewall, reproducible evidence, independent outcome verification,
and honest security-vs-utility metrics.

Core principle: *AI can interpret the threat. Policies control the actions. Evidence determines the outcome.*

## Run it (local, no API key needed)

Two terminals. The backend auto-creates + seeds the SQLite DB on first start.

**Terminal 1 — backend (FastAPI):**

```bash
cd breach-point/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

Health check: http://localhost:8000/api/health — API docs: http://localhost:8000/docs

**Terminal 2 — frontend (React + Vite):**

```bash
cd breach-point/frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## 2-minute demo (in the browser)

1. **Overview** → click **Load Demo Dataset** (seeds MailSentry + policy + 6 scenarios, runs 5 real executions).
2. **Agents** → open **MailSentry**.
3. **Attack Lab** → agent MailSentry, scenario *B. Malicious email*, mode **unprotected** → Start → attack succeeds.
4. Same scenario, mode **protected** → Start → firewall denies `send_email`, handler never executes.
5. Open either run → timeline, auth decisions, deterministic verification, action-flow graph.
6. **Reports** → preview/download the Markdown or JSON evidence report.

Everything runs on the deterministic **mock** provider (clearly labeled in the UI).
No emails are sent, no real data touched — all tools are simulations over synthetic data.

## Backend tests

```bash
cd backend && source .venv/bin/activate && python -m pytest tests/ -q
```

31 tests: unit, integration, and 12 security regression tests.

## Optional: real model via Meta provider

See [docs/meta-provider.md](docs/meta-provider.md). Create `backend/.env`:

```bash
META_API_KEY=your-key-here
META_MODEL=muse-spark-1.3
```

Restart the backend and select provider `meta` on an agent. The firewall and
verifier work identically; the UI labels the provider on every run.

## Docker Compose

```bash
docker compose up --build
```

Frontend at http://localhost:8080 (proxied to the backend). SQLite persists in
the `bp-data` volume. Pass `META_API_KEY`/`META_MODEL` env vars to enable the
Meta provider in the container. (`docker compose config` validated; full image
builds not yet run in this environment — please report issues.)

## Docs

- [docs/architecture.md](docs/architecture.md) — components and trust boundaries
- [docs/meta-provider.md](docs/meta-provider.md) — Llama API setup (verified endpoint)
- [docs/security-limitations.md](docs/security-limitations.md) — honest scope

## Project layout

- `backend/app/` — FastAPI app: tool registry (`tools.py`), firewall (`firewall.py`),
  agent runner (`runner.py`), providers (`providers/`), verification, metrics, reports, seed
- `backend/tests/` — unit, integration, security regression tests
- `frontend/src/` — React dashboard: Overview, Agents, Attack Lab, Policies, Runs,
  Evidence Explorer, Reports, Settings

Single-user development mode: state-changing API endpoints are open for local demo use.
Do not expose publicly without adding authentication.
