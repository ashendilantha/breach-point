import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { Badge, Button, Card, CardHeader, EmptyState, PageHead, Stat } from "../components/ui";

function pct(v: number | null) {
  return v === null ? "n/a" : `${(v * 100).toFixed(1)}%`;
}

export default function Overview() {
  const qc = useQueryClient();
  const metrics = useQuery({ queryKey: ["metrics"], queryFn: () => api.metrics() });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => api.runs("limit=8") });
  const events = useQuery({ queryKey: ["recent"], queryFn: api.recentEvents });
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  const demo = useMutation({
    mutationFn: () => api.demoReset(true),
    onSuccess: () => qc.invalidateQueries(),
  });

  const m = metrics.data;
  const hasData = (m?.totals.runs ?? 0) > 0;
  const blocked = events.data?.filter((e) => e.type === "tool_blocked").length ?? 0;

  const chartData = m
    ? [
        { name: "Attack success", rate: m.attack_success_rate.value !== null ? +(m.attack_success_rate.value * 100).toFixed(1) : 0 },
        { name: "Unauthorized exec", rate: m.unauthorized_action_rate.value !== null ? +(m.unauthorized_action_rate.value * 100).toFixed(1) : 0 },
        { name: "Blocked", rate: m.blocking_rate.value !== null ? +(m.blocking_rate.value * 100).toFixed(1) : 0 },
        { name: "False positive", rate: m.false_positive_rate.value !== null ? +(m.false_positive_rate.value * 100).toFixed(1) : 0 },
        { name: "Task complete", rate: m.legitimate_task_completion_rate.value !== null ? +(m.legitimate_task_completion_rate.value * 100).toFixed(1) : 0 },
      ]
    : [];

  return (
    <div>
      <PageHead
        title="Overview"
        sub="Attack the agent. Test the defense. Prove the result."
        right={
          <Link to="/lab">
            <Button>Run Security Test</Button>
          </Link>
        }
      />

      {!hasData && !metrics.isLoading && (
        <div className="mb-6">
          <EmptyState
            title="No test data yet"
            body="Load the deterministic demo dataset to seed MailSentry, the default policy, and six scenarios — then execute real runs to generate evidence."
            action={
              <Button onClick={() => demo.mutate()} disabled={demo.isPending}>
                {demo.isPending ? "Loading demo…" : "Load Demo Dataset"}
              </Button>
            }
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Demo agents" value={String(agents.data?.length ?? "—")} />
        <Stat label="Executed tests" value={String(m?.totals.runs ?? "—")} sub={hasData ? "demo data" : undefined} />
        <Stat label="Blocked actions (recent)" value={String(blocked)} sub="in recent event window" />
        <Stat
          label="Attack success rate"
          value={pct(m?.attack_success_rate.value ?? null)}
          sub={m ? `${m.attack_success_rate.numerator}/${m.attack_success_rate.denominator} valid, ${m.attack_success_rate.inconclusive} inconclusive` : undefined}
        />
        <Stat
          label="Unauthorized action rate"
          value={pct(m?.unauthorized_action_rate.value ?? null)}
          sub={m ? `${m.unauthorized_action_rate.numerator}/${m.unauthorized_action_rate.denominator}` : undefined}
        />
        <Stat
          label="Blocking rate"
          value={pct(m?.blocking_rate.value ?? null)}
          sub={m ? `${m.blocking_rate.numerator}/${m.blocking_rate.denominator} attempts` : undefined}
        />
        <Stat
          label="False-positive rate"
          value={pct(m?.false_positive_rate.value ?? null)}
          sub={m ? `${m.false_positive_rate.numerator}/${m.false_positive_rate.denominator} benign` : undefined}
        />
        <Stat
          label="Task completion rate"
          value={pct(m?.legitimate_task_completion_rate.value ?? null)}
          sub={m ? `${m.legitimate_task_completion_rate.numerator}/${m.legitimate_task_completion_rate.denominator}` : undefined}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Security vs utility" sub="Rates in percent, from persisted runs. Missing data shows as n/a, never zero." />
          <div className="h-64 px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2d38" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#a7adbb", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#e8e9ec", fontSize: 12 }} width={130} />
                <Tooltip contentStyle={{ background: "#17181f", border: "1px solid #2a2d38", color: "#fff" }} />
                <Bar dataKey="rate" fill="#e8a13c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent test runs" sub="Newest first." right={<Link to="/runs" className="text-[13px] text-[#e8a13c] hover:underline">All runs</Link>} />
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-700 text-[12px] uppercase tracking-wide text-[#a7adbb]">
                <th className="px-5 py-2.5 font-medium">Run</th>
                <th className="px-3 py-2.5 font-medium">Scenario</th>
                <th className="px-3 py-2.5 font-medium">Mode</th>
                <th className="px-3 py-2.5 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {(runs.data ?? []).map((r) => (
                <tr key={r.id} className="border-b border-ink-800 last:border-0">
                  <td className="px-5 py-2.5 font-mono"><Link to={`/runs/${r.id}`} className="text-[#5aa9e6] hover:underline">#{r.id}</Link></td>
                  <td className="px-3 py-2.5 font-mono text-[12px]">{r.scenario_id}</td>
                  <td className="px-3 py-2.5"><Badge value={r.mode} /></td>
                  <td className="px-3 py-2.5"><Badge value={String(r.verification?.overall ?? "—")} /></td>
                </tr>
              ))}
              {(runs.data ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-[#a7adbb]">No runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Recent security events" sub="Decisions and executions across all runs." right={<Link to="/evidence" className="text-[13px] text-[#e8a13c] hover:underline">Evidence explorer</Link>} />
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-ink-700 text-[12px] uppercase tracking-wide text-[#a7adbb]">
              <th className="px-5 py-2.5 font-medium">Event</th>
              <th className="px-3 py-2.5 font-medium">Run</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Tool</th>
              <th className="px-3 py-2.5 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody>
            {(events.data ?? []).slice(0, 10).map((e) => (
              <tr key={e.id} className="border-b border-ink-800 last:border-0">
                <td className="px-5 py-2 font-mono text-[12px]">{e.evidence_ref}</td>
                <td className="px-3 py-2 font-mono"><Link to={`/runs/${e.run_id}`} className="text-[#5aa9e6] hover:underline">#{e.run_id}</Link></td>
                <td className="px-3 py-2 font-mono text-[12px]">{e.type}</td>
                <td className="px-3 py-2 font-mono text-[12px]">{e.tool || "—"}</td>
                <td className="px-3 py-2">{e.decision ? <Badge value={e.decision} /> : <span className="text-[#a7adbb]">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
