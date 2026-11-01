"""Pydantic request/response schemas (separate from DB models)."""
from __future__ import annotations

import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel, Field

Permission = Literal["allow", "deny", "approval"]
RunMode = Literal["protected", "unprotected"]


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    task: str = Field(min_length=1, max_length=4000)
    instructions: str = Field(default="", max_length=8000)
    provider: str = Field(default="mock", max_length=64)
    model: str = Field(default="", max_length=128)
    tools_enabled: list[str] = Field(default_factory=list)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    task: str | None = Field(default=None, min_length=1, max_length=4000)
    instructions: str | None = Field(default=None, max_length=8000)
    provider: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=128)
    tools_enabled: list[str] | None = None


class AgentOut(BaseModel):
    id: int
    name: str
    task: str
    instructions: str
    provider: str
    model: str
    tools_enabled: list[str]
    created_at: dt.datetime | None = None
    updated_at: dt.datetime | None = None


class ToolOut(BaseModel):
    id: str
    description: str
    risk: str
    default_permission: str
    input_schema: dict[str, Any]
    expected_result: str


class PolicyCreate(BaseModel):
    agent_id: int
    name: str = Field(min_length=1, max_length=128)
    rules: dict[str, str] = Field(default_factory=dict)


class PolicyOut(BaseModel):
    id: int
    agent_id: int
    name: str
    version: int
    rules: dict[str, str]
    active: bool
    created_at: dt.datetime | None = None


class ProposalCreate(BaseModel):
    changes: dict[str, str]
    rationale: str = Field(default="", max_length=4000)
    run_id: int | None = None
    evidence_refs: list[str] = Field(default_factory=list)


class ProposalOut(BaseModel):
    id: int
    policy_id: int
    run_id: int | None
    changes: dict[str, str]
    rationale: str
    evidence_refs: list[str]
    status: str
    created_at: dt.datetime | None = None
    decided_at: dt.datetime | None = None


class ScenarioCreate(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=256)
    category: str = Field(min_length=1, max_length=64)
    difficulty: str = Field(default="medium", max_length=16)
    user_task: str = Field(min_length=1, max_length=4000)
    content_type: str = Field(default="email", max_length=32)
    untrusted_content: str = Field(min_length=1, max_length=20000)
    attack_objective: dict[str, Any] = Field(default_factory=dict)
    expected_legitimate: str = Field(default="", max_length=4000)
    expected_legitimate_tools: list[str] = Field(default_factory=list)
    expected_policy: str = Field(default="", max_length=4000)
    success_criteria: str = Field(default="", max_length=4000)
    severity: str = Field(default="medium", max_length=16)
    status: str = Field(default="active", max_length=16)


class ScenarioOut(ScenarioCreate):
    pass


class RunCreate(BaseModel):
    agent_id: int
    scenario_id: str
    mode: RunMode = "protected"
    provider: str | None = Field(default=None, max_length=64)


class RunOut(BaseModel):
    id: int
    agent_id: int
    scenario_id: str
    mode: str
    status: str
    provider: str
    model: str
    policy_version: int | None
    config: dict[str, Any]
    verification: dict[str, Any]
    error: str
    started_at: dt.datetime | None = None
    finished_at: dt.datetime | None = None


class EventOut(BaseModel):
    id: int
    run_id: int
    seq: int
    ts: dt.datetime | None = None
    type: str
    actor: str
    tool: str
    decision: str
    result_summary: str
    explanation: str
    evidence_ref: str
    data: dict[str, Any]


class MetricValue(BaseModel):
    value: float | None
    numerator: int
    denominator: int
    inconclusive: int = 0
    explanation: str


class MetricsSummary(BaseModel):
    attack_success_rate: MetricValue
    unauthorized_action_rate: MetricValue
    blocking_rate: MetricValue
    false_positive_rate: MetricValue
    legitimate_task_completion_rate: MetricValue
    execution_overhead: dict[str, Any]
    totals: dict[str, int]


class ErrorOut(BaseModel):
    detail: str
