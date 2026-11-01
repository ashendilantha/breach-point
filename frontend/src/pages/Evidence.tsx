import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Badge, Button, Card, CardHeader, Field, PageHead, inputCls } from "../components/ui";

export default function Evidence() {
  const runs = useQuery({ queryKey: ["runs50"], queryFn: () => api.runs("limit=50") });
  const [runId, setRunId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const events = useQuery({ queryKey: ["events", Number(runId)], queryFn: () => api.runEvents(Number(runId)), enabled: !!runId });
  const [sel, setSel] = useState<number | null>(null);

  const filtered = (events.data ?? []).filter((e) => !typeFilter || e.type === typeFilter);
  const types = [...new Set((events.data ?? []).map((e) => e.type))];
  const selected = (events.data ?? []).find((e) => e.id === sel);

  return (
    <div>
      <PageHead title="Evidence Explorer" sub="Chronological audit events. Attempted actions and executed actions are distinct event types." />
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <div className="w-56">
            <Field label="Test run">
              <select className={inputCls} value={runId} onChange={(e) => { setRunId(e.target.value); setSel(null); }}>
                <option value="">Select run…</option>
                {(runs.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>#{r.id} · {r.scenario_id} · {r.mode}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="w-56">
            <Field label="Event type">
              <select className={inputCls} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          {runId && <div className="pb-2"><Link to={`/runs/${runId}`} className="text-[13px] text-[#e8a13c] hover:underline">Open run detail →</Link></div>}
        </div>
      </Card>

      {runId ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="Events" sub={`${filtered.length} shown.`} />
            <div className="max-h-[560px] overflow-y-auto bp-scroll">
              <table className="w-full text-left text-[12.5px]">
                <thead className="sticky top-0 bg-ink-900">
                  <tr className="border-b border-ink-700 text-[11px] uppercase tracking-wide text-[#a7adbb]">
                    <th className="px-4 py-2 font-medium">Seq</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Tool</th>
                    <th className="px-3 py-2 font-medium">Decision</th>
                    <th className="px-3 py-2 font-medium">Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} onClick={() => setSel(e.id)} className={`cursor-pointer border-b border-ink-800 last:border-0 hover:bg-ink-800 ${sel === e.id ? "bg-ink-800" : ""}`}>
                      <td className="px-4 py-2 font-mono">{e.seq}</td>
                      <td className="px-3 py-2 font-mono">{e.type}</td>
                      <td className="px-3 py-2 font-mono">{e.tool || "—"}</td>
                      <td className="px-3 py-2">{e.decision ? <Badge value={e.decision} /> : <span className="text-[#a7adbb]">—</span>}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[#a7adbb]">{e.evidence_ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Detail panel" sub={selected ? selected.evidence_ref : "Select an event."} />
            {selected ? (
              <div className="grid gap-3 px-5 py-4 text-[13px]">
                <div className="grid grid-cols-2 gap-1">
                  <span className="text-[#a7adbb]">Timestamp</span><span className="font-mono text-[12px]">{selected.ts ?? "—"}</span>
                  <span className="text-[#a7adbb]">Actor</span><span className="font-mono text-[12px]">{selected.actor}</span>
                  <span className="text-[#a7adbb]">Type</span><span className="font-mono text-[12px]">{selected.type}</span>
                </div>
                <p><span className="text-[#a7adbb]">Summary (observed): </span>{selected.result_summary}</p>
                <p><span className="text-[#a7adbb]">Explanation (generated label): </span>{selected.explanation}</p>
                <pre className="overflow-x-auto rounded-md border border-ink-700 bg-ink-950 p-3 font-mono text-[12px]">{JSON.stringify(selected.data, null, 2)}</pre>
                <div><Button small variant="ghost" onClick={() => setSel(null)}>Clear</Button></div>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-[#a7adbb]">No event selected.</p>
            )}
          </Card>
        </div>
      ) : (
        <Card><p className="px-5 py-8 text-center text-sm text-[#a7adbb]">Select a run to inspect its evidence trail.</p></Card>
      )}
    </div>
  );
}
