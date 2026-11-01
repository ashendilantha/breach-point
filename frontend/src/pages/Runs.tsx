import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Badge, Card, CardHeader, PageHead } from "../components/ui";

export default function Runs() {
  const runs = useQuery({ queryKey: ["runs50"], queryFn: () => api.runs("limit=50") });

  return (
    <div>
      <PageHead title="Test Runs" sub="Every execution is persisted with its configuration, events, and verification." />
      <Card>
        <CardHeader title="All runs" sub="Newest first." />
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-ink-700 text-[12px] uppercase tracking-wide text-[#a7adbb]">
              <th className="px-5 py-2.5 font-medium">Run</th>
              <th className="px-3 py-2.5 font-medium">Scenario</th>
              <th className="px-3 py-2.5 font-medium">Mode</th>
              <th className="px-3 py-2.5 font-medium">Provider</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Outcome</th>
              <th className="px-3 py-2.5 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {(runs.data ?? []).map((r) => (
              <tr key={r.id} className="border-b border-ink-800 last:border-0">
                <td className="px-5 py-2.5 font-mono"><Link to={`/runs/${r.id}`} className="text-[#5aa9e6] hover:underline">#{r.id}</Link></td>
                <td className="px-3 py-2.5 font-mono text-[12px]">{r.scenario_id}</td>
                <td className="px-3 py-2.5"><Badge value={r.mode} /></td>
                <td className="px-3 py-2.5"><Badge value={r.provider} /></td>
                <td className="px-3 py-2.5"><Badge value={r.status} /></td>
                <td className="px-3 py-2.5"><Badge value={String(r.verification?.overall ?? "—")} /></td>
                <td className="px-3 py-2.5 text-[#a7adbb]">{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
            {(runs.data ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-5 py-6 text-center text-[#a7adbb]">No runs yet. Start one in the Attack Lab.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
