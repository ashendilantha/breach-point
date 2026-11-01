const BASE = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((body as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface Agent {
  id: number; name: string; task: string; instructions: string;
  provider: string; model: string; tools_enabled: string[];
}
export interface Tool { id: string; description: string; risk: string; default_permission: string; input_schema: object; expected_result: string }
export interface Policy { id: number; agent_id: number; name: string; version: number; rules: Record<string, string>; active: boolean }
export interface Proposal { id: number; policy_id: number; run_id: number | null; changes: Record<string, string>; rationale: string; evidence_refs: string[]; status: string }
export interface Scenario {
  id: string; name: string; category: string; difficulty: string; user_task: string;
  content_type: string; untrusted_content: string; attack_objective: Record<string, unknown>;
  expected_legitimate: string; expected_legitimate_tools: string[]; expected_policy: string;
  success_criteria: string; severity: string; status: string;
}
export interface Run {
  id: number; agent_id: number; scenario_id: string; mode: string; status: string;
  provider: string; model: string; policy_version: number | null;
  config: Record<string, unknown>; verification: Record<string, unknown>; error: string;
  started_at: string | null; finished_at: string | null;
}
export interface RunEvent {
  id: number; run_id: number; seq: number; ts: string | null; type: string; actor: string;
  tool: string; decision: string; result_summary: string; explanation: string;
  evidence_ref: string; data: Record<string, unknown>;
}
export interface MetricValue { value: number | null; numerator: number; denominator: number; inconclusive: number; explanation: string }
export interface MetricsSummary {
  attack_success_rate: MetricValue; unauthorized_action_rate: MetricValue; blocking_rate: MetricValue;
  false_positive_rate: MetricValue; legitimate_task_completion_rate: MetricValue;
  execution_overhead: Record<string, number | string | null>; totals: Record<string, number>;
}

export const api = {
  health: () => req<{ status: string }>("/api/health"),
  providersHealth: () => req<{ providers: { provider: string; status: string; model: string; note?: string }[] }>("/api/providers/health"),
  agents: () => req<Agent[]>("/api/agents"),
  agent: (id: number) => req<Agent>(`/api/agents/${id}`),
  createAgent: (b: Partial<Agent>) => req<Agent>("/api/agents", { method: "POST", body: JSON.stringify(b) }),
  updateAgent: (id: number, b: Partial<Agent>) => req<Agent>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  agentRuns: (id: number) => req<Run[]>(`/api/agents/${id}/runs`),
  tools: () => req<Tool[]>("/api/tools"),
  policies: (agentId?: number) => req<Policy[]>(`/api/policies${agentId ? `?agent_id=${agentId}` : ""}`),
  createPolicy: (b: { agent_id: number; name: string; rules: Record<string, string> }) =>
    req<Policy>("/api/policies", { method: "POST", body: JSON.stringify(b) }),
  proposals: (status?: string) => req<Proposal[]>(`/api/proposals${status ? `?status=${status}` : ""}`),
  createProposal: (policyId: number, b: { changes: Record<string, string>; rationale: string; run_id?: number | null; evidence_refs?: string[] }) =>
    req<Proposal>(`/api/policies/${policyId}/proposals`, { method: "POST", body: JSON.stringify(b) }),
  approveProposal: (id: number, approve: boolean) =>
    req<Policy | null>(`/api/proposals/${id}/approve?approve=${approve}`, { method: "POST" }),
  draftProposal: (runId: number) => req<Proposal | null>(`/api/runs/${runId}/draft-proposal`, { method: "POST" }),
  scenarios: () => req<Scenario[]>("/api/scenarios"),
  createScenario: (b: Partial<Scenario>) => req<Scenario>("/api/scenarios", { method: "POST", body: JSON.stringify(b) }),
  runs: (q?: string) => req<Run[]>(`/api/runs${q ? `?${q}` : ""}`),
  run: (id: number) => req<Run>(`/api/runs/${id}`),
  createRun: (b: { agent_id: number; scenario_id: string; mode: string; provider?: string }) =>
    req<Run>("/api/runs", { method: "POST", body: JSON.stringify(b) }),
  replayRun: (id: number) => req<Run>(`/api/runs/${id}/replay`, { method: "POST" }),
  runEvents: (id: number) => req<RunEvent[]>(`/api/runs/${id}/events`),
  compare: (a: number, b: number) => req<{ a: Run; b: Run; comparable: boolean; note: string | null }>(`/api/compare?a=${a}&b=${b}`),
  metrics: (q?: string) => req<MetricsSummary>(`/api/metrics/summary${q ? `?${q}` : ""}`),
  recentEvents: () => req<RunEvent[]>("/api/events/recent"),
  demoReset: (runDemo: boolean) => req<{ seeded: object; demo_run_ids: number[]; note: string }>(`/api/demo/reset?run_demo=${runDemo}`, { method: "POST" }),
};

export function download(path: string, filename: string) {
  const a = document.createElement("a");
  a.href = path;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
