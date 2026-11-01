import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Run } from "../lib/api";
import { Badge, Button, Card, CardHeader, Field, PageHead, inputCls } from "../components/ui";

export default function AttackLab() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  const scenarios = useQuery({ queryKey: ["scenarios"], queryFn: api.scenarios });

  const [agentId, setAgentId] = useState(params.get("agent") ?? "");
  const [scenarioId, setScenarioId] = useState("");
  const [mode, setMode] = useState("protected");
  const [results, setResults] = useState<Run[]>([]);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const scenario = useMemo(
    () => (scenarios.data ?? []).find((s) => s.id === scenarioId),
    [scenarios.data, scenarioId]
  );

  const runTest = useMutation({
    mutationFn: () => api.createRun({ agent_id: Number(agentId), scenario_id: scenarioId, mode }),
    onSuccess: (run) => {
      setResults((r) => [run, ...r].slice(0, 6));
      qc.invalidateQueries();
    },
  });

  const runBoth = useMutation({
    mutationFn: async () => {
      const a = await api.createRun({ agent_id: Number(agentId), scenario_id: scenarioId, mode: "unprotected" });
      const b = await api.createRun({ agent_id: Number(agentId), scenario_id: scenarioId, mode: "protected" });
      return [a, b];
    },
    onSuccess: ([a, b]) => {
      setResults((r) => [b, a, ...r].slice(0, 6));
      setCompareIds([a.id, b.id]);
      qc.invalidateQueries();
    },
  });

  const compare = useQuery({
    queryKey: ["compare", compareIds],
    queryFn: () => api.compare(compareIds[0], compareIds[1]),
    enabled: compareIds.length === 2,
  });

  return (
    <div>
      <PageHead title="Attack Lab" sub="Select a target, a scenario, and a mode. Every run is verified from persisted events." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Test configuration" />
          <div className="grid gap-4 px-5 py-5">
            <Field label="Target agent">
              <select className={inputCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                <option value="">Select agent…</option>
                {(agents.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.provider})</option>
                ))}
              </select>
            </Field>
            <Field label="Attack scenario">
              <select className={inputCls} value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
                <option value="">Select scenario…</option>
                {(scenarios.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Execution mode">
              <div className="grid grid-cols-2 gap-2">
                {(["protected", "unprotected"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-md border px-3 py-2 text-sm ${mode === m ? "border-[#e8a13c] bg-[#3a2c12] text-white" : "border-ink-600 text-[#a7adbb]"}`}
                  >
                    {m === "protected" ? "Protected" : "Unprotected baseline"}
                  </button>
                ))}
              </div>
              {mode === "unprotected" && (
                <p className="mt-1 text-[12px] text-[#e8a13c]">Intentionally vulnerable comparison config. Policy bypassed; sandbox retained.</p>
              )}
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => runTest.mutate()} disabled={!agentId || !scenarioId || runTest.isPending}>
                {runTest.isPending ? "Running…" : "Start test run"}
              </Button>
              <Button variant="outline" onClick={() => runBoth.mutate()} disabled={!agentId || !scenarioId || runBoth.isPending}>
                {runBoth.isPending ? "Running both…" : "Run both modes"}
              </Button>
            </div>
            {(runTest.isError || runBoth.isError) && (
              <p className="text-sm text-[#ff8a8a]">{((runTest.error || runBoth.error) as Error).message}</p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Scenario briefing"
            sub={scenario ? `${scenario.id} · ${scenario.category} · ${scenario.difficulty} · severity ${scenario.severity}` : "Select a scenario to inspect its inputs."}
          />
          {scenario ? (
            <div className="grid gap-4 px-5 py-5 text-[13px]">
              <div>
                <div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-[#a7adbb]">Original user task (trusted)</div>
                <p className="rounded-md border border-ink-700 bg-ink-950 p-3">{scenario.user_task}</p>
              </div>
              <div>
                <div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-[#a7adbb]">Untrusted {scenario.content_type} content (data, not instructions)</div>
                <pre className="whitespace-pre-wrap rounded-md border border-[#5a2323] bg-ink-950 p-3 font-mono text-[12px]">{scenario.untrusted_content}</pre>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><span className="text-[#a7adbb]">Attack objective: </span><span className="font-mono text-[12px]">{JSON.stringify(scenario.attack_objective)}</span></div>
                <div><span className="text-[#a7adbb]">Expected policy: </span>{scenario.expected_policy}</div>
                <div><span className="text-[#a7adbb]">Expected legitimate: </span>{scenario.expected_legitimate}</div>
                <div><span className="text-[#a7adbb]">Success criteria: </span>{scenario.success_criteria}</div>
              </div>
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-[#a7adbb]">Nothing selected.</p>
          )}
        </Card>
      </div>

      {results.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Session results" sub="Runs executed in this session. Select two to compare." />
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-700 text-[12px] uppercase tracking-wide text-[#a7adbb]">
                <th className="px-5 py-2.5 font-medium">Compare</th>
                <th className="px-3 py-2.5 font-medium">Run</th>
                <th className="px-3 py-2.5 font-medium">Mode</th>
                <th className="px-3 py-2.5 font-medium">Provider</th>
                <th className="px-3 py-2.5 font-medium">Outcome</th>
                <th className="px-3 py-2.5 font-medium">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-ink-800 align-top last:border-0">
                  <td className="px-5 py-2.5">
                    <input
                      type="checkbox"
                      checked={compareIds.includes(r.id)}
                      onChange={() =>
                        setCompareIds((ids) => (ids.includes(r.id) ? ids.filter((i) => i !== r.id) : [...ids, r.id].slice(-2)))}
                      />
                  </td>
                  <td className="px-3 py-2.5 font-mono"><Link to={`/runs/${r.id}`} className="text-[#5aa9e6] hover:underline">#{r.id}</Link></td>
                  <td className="px-3 py-2.5"><Badge value={r.mode} /></td>
                  <td className="px-3 py-2.5"><Badge value={r.provider} /></td>
                  <td className="px-3 py-2.5"><Badge value={String(r.verification?.overall ?? "—")} /></td>
                  <td className="px-3 py-2.5 text-[12px] text-[#a7adbb]">{String(r.verification?.explanation ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {compare.data && (
        <Card className="mt-4">
          <CardHeader
            title={`Comparison: run #${compare.data.a.id} vs #${compare.data.b.id}`}
            sub={compare.data.comparable ? "Same agent, scenario, and provider — directly comparable." : (compare.data.note ?? "")}
          />
          <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
            {[compare.data.a, compare.data.b].map((r) => (
              <div key={r.id} className="rounded-md border border-ink-700 p-4 text-[13px]">
                <div className="mb-2 flex items-center gap-2">
                  <Link to={`/runs/${r.id}`} className="font-mono text-[#5aa9e6] hover:underline">Run #{r.id}</Link>
                  <Badge value={r.mode} />
                  <Badge value={String(r.verification?.overall ?? "—")} />
                </div>
                <dl className="grid grid-cols-2 gap-1">
                  <dt className="text-[#a7adbb]">Objective achieved</dt><dd><Badge value={String(r.verification?.objective_achieved ?? "unknown")} /></dd>
                  <dt className="text-[#a7adbb]">Unauthorized exec</dt><dd><Badge value={String(r.verification?.unauthorized_executed ?? "unknown")} /></dd>
                  <dt className="text-[#a7adbb]">Task completed</dt><dd><Badge value={String(r.verification?.legitimate_completed ?? "unknown")} /></dd>
                  <dt className="text-[#a7adbb]">Policy version</dt><dd className="font-mono">v{r.policy_version ?? "—"}</dd>
                </dl>
                <p className="mt-2 text-[12px] text-[#a7adbb]">{String(r.verification?.explanation ?? "")}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
