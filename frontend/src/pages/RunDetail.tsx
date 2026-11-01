import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ReactFlow, Background, Controls, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api, download } from "../lib/api";
import { Badge, Button, Card, CardHeader, PageHead } from "../components/ui";

function FlowView({ runId }: { runId: number }) {
  const events = useQuery({ queryKey: ["events", runId], queryFn: () => api.runEvents(runId) });
  const { nodes, edges } = useMemo(() => {
    const evs = (events.data ?? []).filter((e) =>
      ["tool_call_proposed", "auth_decision", "tool_executed", "tool_blocked"].includes(e.type)
    ).slice(0, 40);
    const nodes: Node[] = evs.map((e, i) => ({
      id: String(e.id),
      position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 110 },
      data: { label: `${e.type}\n${e.tool || ""}${e.decision ? ` · ${e.decision}` : ""}` },
      style: {
        background: "#17181f", color: "#e8e9ec", border: "1px solid #2a2d38",
        borderRadius: 6, fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-line",
        width: 200,
      },
    }));
    const edges: Edge[] = evs.slice(1).map((e, i) => ({
      id: `e${i}`, source: String(evs[i].id), target: String(e.id), animated: false,
      style: { stroke: "#3a3e4d" },
    }));
    return { nodes, edges };
  }, [events.data]);

  if (events.isLoading) return <p className="px-5 py-6 text-sm text-[#a7adbb]">Loading flow…</p>;
  return (
    <div className="h-80 bg-ink-950">
      <ReactFlow nodes={nodes} edges={edges} fitView colorMode="dark">
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default function RunDetail() {
  const { id } = useParams();
  const runId = Number(id);
  const qc = useQueryClient();
  const run = useQuery({ queryKey: ["run", runId], queryFn: () => api.run(runId) });
  const events = useQuery({ queryKey: ["events", runId], queryFn: () => api.runEvents(runId) });
  const [sel, setSel] = useState<number | null>(null);

  const replay = useMutation({
    mutationFn: () => api.replayRun(runId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runs50"] }),
  });
  const draft = useMutation({ mutationFn: () => api.draftProposal(runId) });

  const r = run.data;
  const v = (r?.verification ?? {}) as Record<string, unknown>;
  const selected = (events.data ?? []).find((e) => e.id === sel);

  return (
    <div>
      <PageHead
        title={r ? `Run #${r.id} — ${r.scenario_id}` : `Run #${runId}`}
        sub={r ? `Mode ${r.mode} · provider ${r.provider}${r.model ? ` · ${r.model}` : ""} · policy v${r.policy_version ?? "—"}` : ""}
        right={
          r && (
            <>
              <Button variant="outline" small onClick={() => download(`/api/runs/${r.id}/report?format=markdown`, `run-${r.id}-report.md`)}>Export MD</Button>
              <Button variant="outline" small onClick={() => download(`/api/runs/${r.id}/report?format=json`, `run-${r.id}-report.json`)}>Export JSON</Button>
              <Button small onClick={() => replay.mutate()} disabled={replay.isPending}>{replay.isPending ? "Replaying…" : "Replay"}</Button>
            </>
          )
        }
      />

      {replay.data && (
        <p className="mb-4 text-sm text-[#4cc38a]">
          Replayed as <Link to={`/runs/${replay.data.id}`} className="underline">run #{replay.data.id}</Link>.
        </p>
      )}
      {r?.mode === "unprotected" && (
        <p className="mb-4 rounded-md border border-[#8a6428] bg-[#3a2c12] px-4 py-2 text-[13px] text-[#e8a13c]">
          Unprotected baseline: intentionally vulnerable comparison config. Policy bypassed; registration, schema, and sandbox constraints retained.
        </p>
      )}
      {r?.provider === "mock" && (
        <p className="mb-4 rounded-md border border-ink-600 bg-ink-900 px-4 py-2 text-[13px] text-[#5aa9e6]">
          Deterministic mock provider: simulated naive-agent behavior for reproducible testing. Not real model output.
        </p>
      )}

      {r && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Verification (deterministic)" sub="From observed events — never model claims." />
            <div className="grid gap-2 px-5 py-4 text-[13px]">
              <div className="flex justify-between"><span className="text-[#a7adbb]">Overall</span><Badge value={String(v.overall ?? "—")} /></div>
              <div className="flex justify-between"><span className="text-[#a7adbb]">Objective achieved</span><Badge value={String(v.objective_achieved ?? "unknown")} /></div>
              <div className="flex justify-between"><span className="text-[#a7adbb]">Unauthorized exec</span><Badge value={String(v.unauthorized_executed ?? "unknown")} /></div>
              <div className="flex justify-between"><span className="text-[#a7adbb]">Task completed</span><Badge value={String(v.legitimate_completed ?? "unknown")} /></div>
              <div className="flex justify-between"><span className="text-[#a7adbb]">Control behavior</span><Badge value={String(v.control_behavior_ok ?? "unknown")} /></div>
              <p className="mt-1 text-[12px] text-[#a7adbb]">{String(v.explanation ?? "")}</p>
              <div className="mt-2">
                <Button small variant="outline" onClick={() => draft.mutate()} disabled={draft.isPending}>
                  {draft.isPending ? "Drafting…" : "Draft policy proposal"}
                </Button>
                {draft.data === null && <p className="mt-1 text-[12px] text-[#a7adbb]">No undesirable execution observed — nothing to propose.</p>}
                {draft.data && typeof draft.data === "object" && "id" in draft.data && (
                  <p className="mt-1 text-[12px] text-[#4cc38a]">Proposal #{(draft.data as { id: number }).id} created (pending approval).</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Execution timeline" sub="Click an event for the detail panel." />
            <div className="max-h-96 overflow-y-auto bp-scroll">
              <table className="w-full text-left text-[12.5px]">
                <thead className="sticky top-0 bg-ink-900">
                  <tr className="border-b border-ink-700 text-[11px] uppercase tracking-wide text-[#a7adbb]">
                    <th className="px-4 py-2 font-medium">Seq</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Tool</th>
                    <th className="px-3 py-2 font-medium">Decision</th>
                    <th className="px-3 py-2 font-medium">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {(events.data ?? []).map((e) => (
                    <tr key={e.id} onClick={() => setSel(e.id)} className={`cursor-pointer border-b border-ink-800 last:border-0 hover:bg-ink-800 ${sel === e.id ? "bg-ink-800" : ""}`}>
                      <td className="px-4 py-2 font-mono">{e.seq}</td>
                      <td className="px-3 py-2 font-mono">{e.type}</td>
                      <td className="px-3 py-2 font-mono">{e.actor}</td>
                      <td className="px-3 py-2 font-mono">{e.tool || "—"}</td>
                      <td className="px-3 py-2">{e.decision ? <Badge value={e.decision} /> : <span className="text-[#a7adbb]">—</span>}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-[#a7adbb]">{e.result_summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {selected && (
        <Card className="mt-4">
          <CardHeader title={`Event detail — ${selected.evidence_ref}`} sub={`${selected.type} · seq ${selected.seq} · ${selected.ts ?? ""}`} right={<Button small variant="ghost" onClick={() => setSel(null)}>Close</Button>} />
          <div className="grid gap-3 px-5 py-4 text-[13px]">
            <p><span className="text-[#a7adbb]">Explanation: </span>{selected.explanation}</p>
            <p><span className="text-[#a7adbb]">Result: </span>{selected.result_summary}</p>
            <pre className="overflow-x-auto rounded-md border border-ink-700 bg-ink-950 p-3 font-mono text-[12px]">{JSON.stringify(selected.data, null, 2)}</pre>
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader title="Action flow" sub="Proposed → authorized → executed/blocked (React Flow)." />
        <FlowView runId={runId} />
      </Card>
    </div>
  );
}
