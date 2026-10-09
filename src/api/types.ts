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
export type SkillCreate = Schemas['SkillCreate']
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
export type ModelsList = Schemas['ModelsRead']
export type ModelInfo = Schemas['ModelRead']
export type ModelActivate = Schemas['ModelActivate']
export type UserAdmin = Schemas['UserAdminRead']
export type UserCreate = Schemas['UserCreate']
export type UserUpdate = Schemas['UserUpdate']
export type UserWithPassword = Schemas['UserWithPassword']
export type ModelHealth = Schemas['ModelHealth']
export type Client = Schemas['ClientRead']
export type ClientCreate = Schemas['ClientCreate']
export type ClientUpdate = Schemas['ClientUpdate']
export type EvalReportSummary = Schemas['EvalReportSummary']
export type EvalReport = Schemas['EvalReportRead']
export type LearningSummary = Schemas['LearningSummary']
export type FeedbackReport = Schemas['FeedbackReportRead']
export type ApiProject = Schemas['ApiProjectRead']
export type ApiProjectCreate = Schemas['ApiProjectCreate']
export type NewApiKey = Schemas['NewApiKey']
export type Company = Schemas['CompanyRead']
export type CompanyCreate = Schemas['CompanyCreate']
export type CompanyCreated = Schemas['CompanyCreated']
export type DecisionRequest = Schemas['DecisionRequestRead']
export type ThemeStatus = Schemas['ThemeStatusIn']['status']

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
export type BenchReport = Schemas['BenchReport']
export type BenchPerson = Schemas['BenchPerson']
export type SkillGapReport = Schemas['SkillGapReport']
export type SkillGap = Schemas['SkillGap']
export type StaffingPlan = Schemas['StaffingPlan']
export type StaffedTask = Schemas['StaffedTask']
export type ProposedPerson = Schemas['ProposedPerson']
export type HireOrMove = Schemas['HireOrMove']
export type Margin = Schemas['Margin']
export type RateCard = Schemas['RateCard']
export type RateCardLine = Schemas['RateCardRow']
export type EmployeeValue = Schemas['EmployeeValue']
export type ProjectLine = Schemas['ProjectLine']
export type OutcomeRead = Schemas['OutcomeRead']
export type OutcomeResult = Schemas['OutcomeResult']
export type OutcomeProof = Schemas['OutcomeProof']
export type FairnessReport = Schemas['FairnessReport']
export type Judgement = Schemas['Judgement']
export type RollOffReport = Schemas['RollOffReport']
export type RollOff = Schemas['RollOff']
export type PlanningActionRead = Schemas['PlanningActionRead']
export type PlanningActionCreate = Schemas['PlanningActionCreate']
export type WhatIfIn = Schemas['WhatIfIn']
export type WhatIfResult = Schemas['WhatIfResult']
export type ClientProfile = Schemas['ClientProfile']
export type BusinessUnitRef = Schemas['BusinessUnitRef']
export type BusinessUnit = Schemas['BusinessUnitRead']
export type HeadOption = Schemas['HeadOption']
export type SkillSuggestion = Schemas['SkillSuggestionRead']
export type CareerView = Schemas['CareerView']
export type DataQuality = Schemas['DataQuality']
export type ClientRateLine = Schemas['ClientRateLine']
export type ClientRateIn = Schemas['ClientRateIn']

// Dashboard (ADR 028)
export type Dashboard = Schemas['Dashboard']
export type DashboardRing = Schemas['Ring']
export type MonthTasks = Schemas['MonthTasks']
export type MonthIdleCost = Schemas['MonthIdleCost']
export type OpenTaskLine = Schemas['OpenTaskLine']

// Workforce planning pack (ADR 031)
export type KeyPersonReport = Schemas['KeyPersonReport']
export type ScarceSkill = Schemas['ScarceSkill']
export type ProjectRisk = Schemas['ProjectRisk']
export type TeamIn = Schemas['TeamIn']
export type TeamPlan = Schemas['TeamPlan']
export type PeopleFilters = Schemas['PeopleFilters']
export type InterpretedSearch = Schemas['InterpretedSearch']
export type PeopleSearchResult = Schemas['PeopleSearchResult']
export type PersonHit = Schemas['PersonHit']
export type RfpDrafts = Schemas['RfpDrafts']
export type DraftTask = Schemas['DraftTask']
export type PreferencesIn = Schemas['PreferencesIn']
export type PreferencesRead = Schemas['PreferencesRead']
export type CourseIn = Schemas['CourseIn']
export type CourseRead = Schemas['CourseRead']
export type AssignmentRead = Schemas['AssignmentRead']
export type LearningOverview = Schemas['LearningOverview']
export type LearningStatus = Schemas['LearningStatus']
export type OpportunityReport = Schemas['OpportunityReport']
export type OpportunityFlag = Schemas['OpportunityFlag']
export type InterviewPlan = Schemas['InterviewPlan']
export type CapacityReport = Schemas['CapacityReport']
export type PersonRef = Schemas['PersonRef']

// Pipeline, timesheets, reports, setup, digest, self-service (ADR 032)
export type DealIn = Schemas['DealIn']
export type DealRead = Schemas['DealRead']
export type DealStatus = Schemas['DealStatus']
export type DemandForecast = Schemas['DemandForecast']
export type WorkingOn = Schemas['WorkingOn']
export type SavingsReport = Schemas['SavingsReport']
export type SetupStatus = Schemas['SetupStatus']
export type Digest = Schemas['Digest']
export type MyProfile = Schemas['MyProfile']
export type MonthNumbers = Schemas['MonthNumbers']

// Bench-to-billable plan (ADR 033)
export type BenchPlan = Schemas['BenchPlan']
export type BenchStep = Schemas['BenchStep']
