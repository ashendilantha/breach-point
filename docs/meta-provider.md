# Meta provider setup (Meta Model API — Muse)

BREACH//POINT calls Meta's hosted **Model API** (serves Muse models) through
its **OpenAI-compatible** endpoint. Verified live 2026-11-01 with a real key:

| Item | Value |
|---|---|
| Base URL | `https://api.meta.ai/v1` |
| Chat completions | `POST {base}/chat/completions` |
| Models list | `GET {base}/models` |
| Auth | `Authorization: Bearer <key>` |
| Key env vars | `META_API_KEY` (preferred) or `LLAMA_API_KEY` |
| Model env var | `META_MODEL` (exact ID from `/models`) |

Confirmed working models include `muse-spark-1.3` (recommended), `muse-spark-1.2`,
`muse-spark-1.1` (plus `muse-wonder-1.0`, `sam-3.1`, others on `/models`).
Hackathon participants receive API credits on their account.

The Llama API compat endpoint (`https://api.llama.com/compat/v1`) has the same
request shape and can be used via `META_API_BASE_URL` with a Llama key.

## Configure

Create `backend/.env` (git-ignored, never commit it):

```bash
META_API_KEY=your-key-here
META_MODEL=<exact-model-id-from-/models>
```

Optional overrides: `META_API_BASE_URL`, `META_TIMEOUT_SECONDS` (default 30).

## Verify

```bash
curl -s http://localhost:8000/api/providers/health | python3 -m json.tool
```

`meta.status` should be `ok`. Then run any scenario with provider `meta`
(Attack Lab uses the agent's provider; set it to `meta` on the agent page).

## How it works

- The provider sends the trusted task + untrusted content (labeled with
  provenance) and asks the model to append proposed tool calls as one
  fenced ```json block.
- Unparseable output yields **zero tool calls** — never guessed actions.
- Every proposed call still passes through the firewall and verifier,
  exactly like the mock provider. Security enforcement never depends
  on the model.
- Capabilities default to unverified: plain text generation only. No
  assumed tool-calling, structured-output, or vision support.
- Secrets are redacted from errors; keys never leave the backend.

## Troubleshooting

- `unconfigured`: key or model missing from env/`backend/.env` (restart backend after editing).
- `HTTP 401`: invalid/expired key.
- `HTTP 429`: rate limited — retry later or use mock for iteration.
- `Unexpected response format`: endpoint returned non-standard payload; the
  run is preserved with a provider error for inspection.
