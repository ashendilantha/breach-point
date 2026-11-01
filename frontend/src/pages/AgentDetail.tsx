import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Badge, Button, Card, CardHeader, Field, PageHead, inputCls } from "../components/ui";

export default function AgentDetail() {
  const { id } = useParams();
  const agentId = Number(id);
  const qc = useQueryClient();
  const agent = useQuery({ queryKey: ["agent", agentId], queryFn: () => api.agent(agentId) });
  const tools = useQuery({ queryKey: ["tools"], queryFn: api.tools });
  const policies = useQuery({ queryKey: ["policies", agentId], queryFn: () => api.policies(agentId) });
  const runs = useQuery({ queryKey: ["agentRuns", agentId], queryFn: () => api.agentRuns(agentId) });
  const [form, setForm] = useState<{ name: string; task: string; instructions: string; provider: string; model: string; tools_enabled: string[] } | null>(null);

  const save = useMutation({
    mutationFn: (b: Partial<{ name: string; task: string; instructions: string; provider: string; model: string; tools_enabled: string[] }>) =>
      api.updateAgent(agentId, b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent", agentId] }); qc.invalidateQueries({ queryKey: ["agents"] }); setForm(null); },
  });

  if (agent.isLoading) return <p className="text-sm text-[#a7adbb]">Loading…</p>;
  if (!agent.data) return <p className="text-sm text-[#ff8a8a]">Agent not found.</p>;
  const a = agent.data;
  const f = form ?? { name: a.name, task: a.task, instructions: a.instructions, provider: a.provider, model: a.model, tools_enabled: a.tools_enabled };
  const active = (policies.data ?? []).find((p) => p.active);

  const toggleTool = (tid: string) =>
    setForm({ ...f, tools_enabled: f.tools_enabled.includes(tid) ? f.tools_enabled.filter((t) => t !== tid) : [...f.tools_enabled, tid] });

  return (
    <div>
      <PageHead
        title={a.name}
        sub={`Agent #${a.id} · provider `}
        right={<><Badge value={a.provider} /><Link to={`/lab?agent=${a.id}`}><Button>Run test</Button></Link></>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Configuration" sub="Trusted operator settings. Untrusted content can never change these." />
          <div className="grid gap-4 px-5 py-5">
            <Field label="Display name">
              <input className={inputCls} value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Intended task">
              <textarea className={inputCls} rows={2} value={f.task} onChange={(e) => setForm({ ...f, task: e.target.value })} />
            </Field>
            <Field label="Instructions">
              <textarea className={inputCls} rows={4} value={f.instructions} onChange={(e) => setForm({ ...f, instructions: e.target.value })} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Provider">
                <select className={inputCls} value={f.provider} onChange={(e) => setForm({ ...f, provider: e.target.value })}>
                  <option value="mock">mock (deterministic demo)</option>
                  <option value="meta">meta (requires API config)</option>
                </select>
              </Field>
              <Field label="Model">
                <input className={inputCls} value={f.model} onChange={(e) => setForm({ ...f, model: e.target.value })} placeholder="(provider default)" />
              </Field>
            </div>
            <Field label="Enabled tools">
              <div className="flex flex-wrap gap-2">
                {(tools.data ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTool(t.id)}
                    title={t.description}
                    className={`rounded-md border px-3 py-1.5 font-mono text-[12px] ${f.tools_enabled.includes(t.id) ? "border-[#e8a13c] bg-[#3a2c12] text-white" : "border-ink-600 text-[#a7adbb]"}`}
                  >
                    {t.id}
                  </button>
                ))}
              </div>
            </Field>
            <div>
              <Button onClick={() => save.mutate(f)} disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
              {save.isError && <p className="mt-2 text-sm text-[#ff8a8a]">{(save.error as Error).message}</p>}
            </div>
          </div>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Active policy" sub={active ? `${active.name} · version ${active.version}` : "No active policy."} right={<Link to="/policies" className="text-[13px] text-[#e8a13c] hover:underline">Manage</Link>} />
            <table className="w-full text-left text-[13px]">
              <tbody>
                {active && Object.entries(active.rules).map(([tool, perm]) => (
                  <tr key={tool} className="border-b border-ink-800 last:border-0">
                    <td className="px-5 py-2 font-mono text-[12px]">{tool}</td>
                    <td className="px-3 py-2"><Badge value={perm} /></td>
                  </tr>
                ))}
              {!active && <tr><td className="px-5 py-4 text-[#a7adbb]">Create a policy to protect this agent.</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader title="Previous test runs" sub="Latest 10 for this agent." />
          <table className="w-full text-left text-[13px]">
            <tbody>
              {(runs.data ?? []).slice(0, 10).map((r) => (
                <tr key={r.id} className="border-b border-ink-800 last:border-0">
                  <td className="px-5 py-2 font-mono"><Link to={`/runs/${r.id}`} className="text-[#5aa9e6] hover:underline">#{r.id}</Link></td>
                  <td className="px-3 py-2 font-mono text-[12px]">{r.scenario_id}</td>
                  <td className="px-3 py-2"><Badge value={r.mode} /></td>
                  <td className="px-3 py-2"><Badge value={String(r.verification?.overall ?? "—")} /></td>
                </tr>
              ))}
              {(runs.data ?? []).length === 0 && <tr><td className="px-5 py-4 text-[#a7adbb]">No runs yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
    </div>
  );
}
