// Mirrors docs/06-api-contract.md (backend repo). Hand-written only until the Phase 2 backend
// publishes its OpenAPI schema; then these are replaced by generated types (ADR 011).

export type Level = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6'
export type Band = 'shortlist' | 'review' | 'hidden'
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'open' | 'matching' | 'shortlisted' | 'filled' | 'cancelled'
export type DecisionType = 'bool' | 'choice' | 'score'
export type FeedbackAction = 'accept' | 'reject'
export type RejectReason =
  | 'skill_gap'
  | 'level_mismatch'
  | 'availability'
  | 'domain_gap'
  | 'client_preference'
  | 'already_planned'
  | 'other'

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface SkillRef {
  id: string
  name: string
}

export interface Skill {
  id: string
  name: string
  category: string
  aliases: string[]
}

export interface SkillRequirement {
  skill: SkillRef
  min_proficiency: number
  must_have: boolean
}

export interface Task {
  id: string
  code: string
  title: string
  description: string
  client_code: string
  domain: string
  required_level: Level
  min_years_experience: number
  location_constraint: string[]
  work_mode: string
  client_timezone: string
  min_timezone_overlap_hours: number
  start_date: string
  duration_weeks: number
  allocation_pct_required: number
  max_cost_band: string
  clearance_required: string | null
  priority: TaskPriority
  status: TaskStatus
  requirements: SkillRequirement[]
}

export interface TaskCreate {
  title: string
  description: string
  client_code: string
  domain: string
  required_level: Level
  min_years_experience: number
  location_constraint: string[]
  work_mode: string
  client_timezone: string
  min_timezone_overlap_hours: number
  start_date: string
  duration_weeks: number
  allocation_pct_required: number
  max_cost_band: string
  clearance_required: string | null
  priority: TaskPriority
  requirements: { skill_id: string; min_proficiency: number; must_have: boolean }[]
}

export interface InterpretResponse {
  title: string | null
  client_code: string | null
  domain: string | null
  required_level: Level | null
  min_years_experience: number | null
  must_skills: string[]
  nice_skills: string[]
  start_in_days: number | null
  duration_weeks: number | null
  allocation_pct_required: number | null
  work_mode: string | null
  location: string | null
  priority: TaskPriority | null
  unmatched_skills: string[]
  notes: string[]
  model: string
}

export interface DecisionOption {
  value: string
  description: string
}

export interface DecisionDefinition {
  key: string
  version: number
  label: string
  type: DecisionType
  question: string
  options: DecisionOption[]
}

export interface MatchRun {
  id: string
  task_id: string
  status: RunStatus
  started_at: string | null
  finished_at: string | null
  error: string | null
  model: string | null
  decision_set_version: string
  thresholds_version: string
  candidate_count: number
  retrieved_count: number
  total_cost_usd: number
  latency_ms: number
  run_flags: string[]
  filter_reason_counts: Record<string, number>
}

export interface MatchRunCreated {
  run_id: string
  status: RunStatus
}

export interface EmployeeRef {
  id: string
  employee_code: string
  full_name: string
  designation: string
  level: Level
  location: string
}

export interface CandidateFeatures {
  must_have_coverage: number
  nice_to_have_coverage: number
  related_skill_hits: number
  level_gap: number
  years_gap: number
  domain_project_count: number
  most_recent_relevant_skill_months: number | null
  available_capacity_pct: number
  low_data: boolean
  inconsistent_data: boolean
}

export interface DecisionResult {
  key: string
  version: number
  type: DecisionType
  chosen: string
  probs: Record<string, number>
  flags: string[]
}

export interface ExplanationPoint {
  fact_ids: string[]
  text: string
}

export interface ExplanationFact {
  id: string
  label: string
  value: string
}

export interface Explanation {
  summary: string
  strengths: ExplanationPoint[]
  gaps: ExplanationPoint[]
  facts: ExplanationFact[]
}

export interface Feedback {
  action: FeedbackAction
  reject_reason: RejectReason | null
  comment: string | null
  by: string | null
  at: string
}

export interface ShortlistItem {
  id: string
  rank: number
  rank_score: number
  band: Band
  employee: EmployeeRef
  features: CandidateFeatures
  decisions: DecisionResult[]
  flags: string[]
  contradictions: string[]
  explanation: Explanation | null
  explanation_status: 'ok' | 'unavailable' | null
  feedback: Feedback | null
}

export interface ExcludedCandidate {
  employee: EmployeeRef
  filter_reasons: string[]
}

export interface FeedbackInput {
  action: FeedbackAction
  reject_reason?: RejectReason
  comment?: string
}

export interface Problem {
  type: string
  title: string
  status: number
  code: string
  detail: string
  request_id?: string
}
