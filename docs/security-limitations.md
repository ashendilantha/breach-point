# Security limitations (honest scope)

What BREACH//POINT **does** guarantee in this MVP:

- Every tool call passes through one firewall enforcement point; denied
  calls never execute (proven by regression tests 2, 3, 4, 9).
- Tools are simulations over synthetic data: no real email, payments,
  files, or third-party effects are possible through them.
- Verification is independent of the model under test.
- Policy changes require explicit user approval and are versioned.

What it does **not** yet do:

- **No authentication.** Single-user dev mode; state-changing endpoints
  are open. Do not expose publicly without adding auth (see README).
- **No human approval queue.** `approval` rules currently hold (block)
  the action; there is no approve/deny inbox UI yet.
- **SQLite + sync I/O.** Fine for local demo; not sized for concurrent load.
- **Mock ≠ real attacker.** The mock provider simulates a naive agent;
  real-model behavior must be measured separately (Meta provider supported).
- **No prompt-level defenses.** Protection is at the action layer
  (authorization), not input filtering — by design, but prompt-injection
  *detection* itself is out of scope.
- **Secrets handling is basic.** Keys via env only, redacted from errors,
  but there is no vault integration or audit of key access.
- **CORS allows only the local dev origin**; tighten per deployment.
