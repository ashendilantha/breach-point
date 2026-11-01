import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, download } from "../lib/api";
import { Badge, Button, Card, CardHeader, Field, PageHead, inputCls } from "../components/ui";

export default function Reports() {
  const runs = useQuery({ queryKey: ["runs50"], queryFn: () => api.runs("limit=50") });
  const [runId, setRunId] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState("");

  const loadPreview = async () => {
    const res = await fetch(`/api/runs/${runId}/report?format=markdown`);
    setPreview(await res.text());
    setShowPreview(true);
  };

  return (
    <div>
      <PageHead
        title="Reports"
        sub="Evidence-backed reports. Provider provenance (mock vs real model) is always labeled."
        right={
          <>
            <Button variant="outline" small onClick={() => download("/api/reports/full?format=markdown", "breachpoint-report.md")}>Full report (MD)</Button>
            <Button variant="outline" small onClick={() => download("/api/reports/full?format=json", "breachpoint-report.json")}>Full report (JSON)</Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <div className="w-64">
            <Field label="Per-run report">
              <select className={inputCls} value={runId} onChange={(e) => { setRunId(e.target.value); setShowPreview(false); }}>
                <option value="">Select run…</option>
                {(runs.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>#{r.id} · {r.scenario_id} · {r.mode}</option>
                ))}
              </select>
            </Field>
          </div>
          {runId && (
            <div className="flex gap-2 pb-0.5">
              <Button small onClick={loadPreview}>Preview</Button>
              <Button small variant="outline" onClick={() => download(`/api/runs/${runId}/report?format=markdown`, `run-${runId}-report.md`)}>MD</Button>
              <Button small variant="outline" onClick={() => download(`/api/runs/${runId}/report?format=json`, `run-${runId}-report.json`)}>JSON</Button>
            </div>
          )}
        </div>
      </Card>

      {showPreview && (
        <Card>
          <CardHeader title="Markdown preview" sub="Exactly what the download contains." />
          <pre className="max-h-[600px] overflow-y-auto bp-scroll whitespace-pre-wrap px-5 py-4 font-mono text-[12.5px] leading-relaxed">{preview}</pre>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader title="Reportable runs" sub="Each run carries verification and evidence references." />
        <table className="w-full text-left text-[13px]">
          <tbody>
            {(runs.data ?? []).slice(0, 20).map((r) => (
              <tr key={r.id} className="border-b border-ink-800 last:border-0">
                <td className="px-5 py-2.5 font-mono"><Link to={`/runs/${r.id}`} className="text-[#5aa9e6] hover:underline">#{r.id}</Link></td>
                <td className="px-3 py-2.5 font-mono text-[12px]">{r.scenario_id}</td>
                <td className="px-3 py-2.5"><Badge value={r.provider} /></td>
                <td className="px-3 py-2.5"><Badge value={String(r.verification?.overall ?? "—")} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
