import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Badge, Button, Card, CardHeader, Field, PageHead, inputCls } from "../components/ui";

export default function Agents() {
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  const tools = useQuery({ queryKey: ["tools"], queryFn: api.tools });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", task: "", instructions: "", provider: "mock", model: "", tools_enabled: ["list_emails", "read_email", "summarize_email", "search_email"] });

  const create = useMutation({
    mutationFn: () => api.createAgent(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); setShow(false); },
  });

  const toggleTool = (id: string) =>
    setForm((f) => ({
      ...f,
      tools_enabled: f.tools_enabled.includes(id) ? f.tools_enabled.filter((t) => t !== id) : [...f.tools_enabled, id],
    }));

  return (
    <div>
      <PageHead
        title="Agents"
        sub="Demo agents under test. Each agent has a task, instructions, provider, and enabled tools."
        right={<Button onClick={() => setShow((s) => !s)}>{show ? "Cancel" : "New Agent"}</Button>}
      />

      {show && (
        <Card className="mb-6">
          <CardHeader title="Create demo agent" sub="Tools enabled here can still be denied by the agent's firewall policy." />
          <div className="grid gap-4 px-5 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Display name">
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MailSentry-2" />
              </Field>
              <Field label="Provider">
                <select className={inputCls} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                  <option value="mock">mock (deterministic demo)</option>
                  <option value="meta">meta (requires API config)</option>
                </select>
              </Field>
            </div>
            <Field label="Intended task">
              <input className={inputCls} value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} placeholder="Read synthetic emails and summarize…" />
            </Field>
            <Field label="Instructions">
              <textarea className={inputCls} rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Trusted system instructions…" />
            </Field>
            <Field label="Enabled tools">
              <div className="flex flex-wrap gap-2">
                {(tools.data ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTool(t.id)}
                    className={`rounded-md border px-3 py-1.5 font-mono text-[12px] ${form.tools_enabled.includes(t.id) ? "border-[#e8a13c] bg-[#3a2c12] text-white" : "border-ink-600 text-[#a7adbb]"}`}
                  >
                    {t.id}
                  </button>
                ))}
              </div>
            </Field>
            {create.isError && <p className="text-sm text-[#ff8a8a]">{(create.error as Error).message}</p>}
            <div>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.task}>
                {create.isPending ? "Creating…" : "Create agent"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {(agents.data ?? []).map((a) => (
          <Card key={a.id}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <Link to={`/agents/${a.id}`} className="text-[16px] font-semibold text-white hover:text-[#e8a13c]">
                  {a.name}
                </Link>
                <p className="mt-0.5 max-w-2xl text-[13px] text-[#a7adbb]">{a.task}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge value={a.provider} />
                  {a.model && <span className="font-mono text-[11px] text-[#a7adbb]">{a.model}</span>}
                  <span className="font-mono text-[11px] text-[#a7adbb]">{a.tools_enabled.length} tools enabled</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/agents/${a.id}`}><Button variant="outline" small>Configure</Button></Link>
                <Link to={`/lab?agent=${a.id}`}><Button small>Run test</Button></Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
