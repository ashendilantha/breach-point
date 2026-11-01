# Demo video script (2:30–3:00) — BREACH//POINT

Target: Meta Global AI Developer Hackathon 2026 judges. Record at 1080p,
narrate over the live UI at http://localhost:5173. Reset demo data first
(Overview → Load Demo Dataset) so numbers are fresh.

## 0:00–0:20 — The problem (Overview page)

> "AI agents read email, browse pages, and call tools. What happens when the
> content they read tells them to do something evil? Meet BREACH//POINT:
> attack the agent, test the defense, prove the result — with evidence,
> not claims."

Show the dashboard: agents, runs, attack success rate, security-vs-utility chart.

## 0:20–0:50 — The victim (Agents → MailSentry)

Open MailSentry. Read the task aloud: *"summarize email, never send or export."*
Show enabled tools + active policy: reads allowed, `send_email` /
`export_private_data` denied.

> "The policy is deterministic. The model can propose anything — the firewall
> decides what executes."

## 0:50–1:30 — The attack, both modes (Attack Lab)

Select MailSentry + scenario B (malicious email), **unprotected** → Start.
Point at the result: `attack_succeeded`, `send_email` executed.

Then run the SAME scenario **protected** → Start: `attack_blocked`.

> "Same agent, same attack. Without the firewall the email goes out.
> With it, the attempt is blocked — and the handler never runs."

## 1:30–2:00 — The proof (Run detail)

Open the protected run. Scroll the timeline: proposed → DENY → blocked,
while `read_email`/`summarize_email` were allowed and executed.

> "We don't trust what the model says. The verifier reads the audit events:
> the attack was attempted, blocked, and the legitimate task still completed.
> Behavioral and enforcement outcomes, recorded separately."

Flash the action-flow graph.

## 2:00–2:25 — Metrics + real model (Overview, Reports)

Show attack success rate, blocking rate, false positives — all with
denominators. Mention: *"runs on the deterministic mock for reproducibility,
and on Meta's Llama API"* — show one `meta`-labeled run if configured.

Export the Markdown report: *"every finding ships with evidence references
and reproduction steps."*

## 2:25–2:40 — Close

> "AI interprets the threat. Policies control the actions. Evidence determines
> the outcome. BREACH//POINT — prompt-injection testing you can prove."

End card: repo URL + `docker compose up --build`.

## Checklist before recording

- [ ] Fresh demo data loaded (Overview → Load Demo Dataset)
- [ ] One unprotected + one protected run of scenario B completed
- [ ] At least one `meta`-provider run visible (if API configured)
- [ ] Reports page exports clean Markdown
- [ ] No secrets visible on screen (keys stay in backend/.env, never shown)
