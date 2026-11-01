import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Badge, Button, Card, CardHeader, Field, PageHead, inputCls } from "../components/ui";

const PERMS = ["allow", "deny", "approval"] as const;

export default function Policies() {
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  const tools = useQuery({ queryKey: ["tools"], queryFn: api.tools });
  const [agentId, setAgentId] = useState("");
  const policies = useQuery({ queryKey: ["policies", agentId], queryFn: () => api.policies(agentId ? Number(agentId) : undefined) });
  const proposals = useQuery({ queryKey: ["proposals"], queryFn: () => api.proposals() });
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [name, setName] = useState("Updated policy");

  const shown = agentId ? (policies.data ?? []) : (policies.data ?? []);
  const active = shown.find((p) => p.active);
  const rules = draft ?? active?.rules ?? {};

  const save = useMutation({
    mutationFn: (fullRules: Record<string, string>) => api.createPolicy({ agent_id: Number(agentId), name, rules: fullRules }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["policies", agentId] }); setDraft(null); },
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) => api.approveProposal(id, approve),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proposals"] }); qc.invalidateQueries({ queryKey: ["policies", agentId] }); },
  });

  return (
    <div>
      <PageHead title="Security Policies" sub="Deterministic allow / deny / approval rules per agent. Editing creates a new version; history is kept." />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <div className="w-64">
            <Field label="Agent">
              <select className={inputCls} value={agentId} onChange={(e) => { setAgentId(e.target.value); setDraft(null); }}>
                <option value="">All agents</option>
                {(agents.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
          </div>
          {active && <div className="pb-2 text-[13px] text-[#a7adbb]">Active: <span className="text-white">{active.name}</span> · version {active.version}</div>}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Policy editor" sub={agentId ? "Changes save as a new active version." : "Select an agent to edit its policy."} />
          <div className="px-5 py-4">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-700 text-[12px] uppercase tracking-wide text-[#a7adbb]">
                  <th className="py-2 font-medium">Tool</th>
                  <th className="font-medium">Risk</th>
                  <th className="font-medium">Permission</th>
                </tr>
              </thead>
              <tbody>
                {(tools.data ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-ink-800 last:border-0">
                    <td className="py-2 pr-3 font-mono text-[12px]" title={t.description}>{t.id}</td>
                    <td className="pr-3 text-[#a7adbb]">{t.risk}</td>
                    <td>
                      <div className="flex gap-1 py-1">
                        {PERMS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            disabled={!agentId}
                            onClick={() => setDraft({ ...rules, [t.id]: p })}
                            className={`rounded px-2 py-0.5 font-mono text-[11px] ${(rules[t.id] ?? t.default_permission) === p ? "bg-[#e8a13c] font-semibold text-black" : "bg-ink-700 text-[#a7adbb]"}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {agentId && (
              <div className="mt-4 flex items-end gap-3">
                <div className="w-56">
                  <Field label="New version name">
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                </div>
                <Button
                  onClick={() => {
                    const full: Record<string, string> = {};
                    for (const t of tools.data ?? []) full[t.id] = rules[t.id] ?? t.default_permission;
                    save.mutate(full);
                  }}
                  disabled={save.isPending}
                >
                  {save.isPending ? "Saving…" : "Save as new version"}
                </Button>
              </div>
            )}
            {save.isError && <p className="mt-2 text-sm text-[#ff8a8a]">{(save.error as Error).message}</p>}
          </div>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Version history" sub="Old versions stay for reproducibility." />
            <table className="w-full text-left text-[13px]">
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-5 py-2">v{p.version} — {p.name}</td>
                    <td className="px-3 py-2">{p.active ? <Badge value="approved" label="active" /> : <span className="text-[#a7adbb]">superseded</span>}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td className="px-5 py-4 text-[#a7adbb]">No policies.</td></tr>}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardHeader title="Improvement proposals" sub="Drafts are inert until a user approves them." />
            <div className="grid gap-3 px-5 py-4">
              {(proposals.data ?? []).map((p) => (
                <div key={p.id} className="rounded-md border border-ink-700 p-3 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px]">proposal #{p.id} → policy #{p.policy_id}</span>
                    <Badge value={p.status} />
                  </div>
                  <p className="mt-1 text-[#a7adbb]">{p.rationale}</p>
                  <p className="mt-1 font-mono text-[12px]">{Object.entries(p.changes).map(([k, v]) => `${k}=${v}`).join(", ")}</p>
                  {p.status === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <Button small onClick={() => decide.mutate({ id: p.id, approve: true })} disabled={decide.isPending}>Approve & activate</Button>
                      <Button small variant="ghost" onClick={() => decide.mutate({ id: p.id, approve: false })} disabled={decide.isPending}>Reject</Button>
                    </div>
                  )}
                </div>
              ))}
              {(proposals.data ?? []).length === 0 && <p className="text-sm text-[#a7adbb]">No proposals. Draft one from a failed run's detail page.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
