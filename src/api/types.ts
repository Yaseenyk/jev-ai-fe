// API types are generated from the backend's OpenAPI description (docs/04, ADR 011):
//   backend: uv run python scripts/export_openapi.py   → src/api/openapi.json
//   here:    npm run gen:api                           → src/api/schema.d.ts
// This file only gives the generated schemas the short names the screens use. Never hand-write
// an API shape here; change the backend schema and regenerate instead.
import type { components } from '@/api/schema'

type Schemas = components['schemas']

export type Level = Schemas['Level']
export type Band = Schemas['Band']
export type RunStatus = Schemas['RunStatus']
export type TaskPriority = Schemas['TaskPriority']
export type TaskStatus = Schemas['TaskStatus']
export type FeedbackAction = Schemas['FeedbackAction']
export type RejectReason = Schemas['RejectReason']
export type UserRole = Schemas['UserRole']
export type Domain = Schemas['Domain']
export type WorkMode = Schemas['WorkMode']
export type CostBand = Schemas['CostBand']
export type Location = Schemas['Location']
export type DecisionType = Schemas['DecisionRead']['type']

export type SkillRef = Schemas['SkillRef']
export type Skill = Schemas['SkillRead']
export type SkillRequirement = Schemas['SkillRequirementRead']
export type Task = Schemas['TaskRead']
export type TaskCreate = Schemas['TaskCreate']
export type InterpretResponse = Schemas['InterpretResponse']

export type DecisionOption = Schemas['DecisionOptionRead']
export type DecisionDefinition = Schemas['DecisionRead']
export type Thresholds = Schemas['ThresholdsRead']
export type MatchRun = Schemas['MatchRunRead']
export type MatchRunCreated = Schemas['MatchRunCreated']

export type EmployeeRef = Schemas['EmployeeRef']
export type CandidateFeatures = Schemas['CandidateFeaturesRead']
export type DecisionResult = Schemas['DecisionResultRead']
export type ExplanationPoint = Schemas['ExplanationPointRead']
export type ExplanationFact = Schemas['ExplanationFactRead']
export type Explanation = Schemas['ExplanationRead']
export type Feedback = Schemas['FeedbackRead']
export type ShortlistItem = Schemas['ShortlistItemRead']
export type ExcludedCandidate = Schemas['ExcludedRead']
export type FeedbackInput = Schemas['FeedbackInput']

export type User = Schemas['UserRead']
export type TokenResponse = Schemas['TokenResponse']

export type AdminRun = Schemas['AdminRunRead']
export type ThresholdVersion = Schemas['ThresholdVersionRead']
export type ThresholdsHistory = Schemas['ThresholdsHistory']
export type ThresholdsUpdate = Schemas['ThresholdsUpdate']
export type EvalReportSummary = Schemas['EvalReportSummary']
export type EvalReport = Schemas['EvalReportRead']
export type LearningSummary = Schemas['LearningSummary']

/** The list envelope every list endpoint returns (docs/06 §1). */
export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

/** RFC 9457 problem+json error body (docs/03 §5); not part of the OpenAPI schemas. */
export interface Problem {
  type: string
  title: string
  status: number
  code: string
  detail: string
  request_id?: string | null
}
