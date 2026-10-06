// Planned HR contract (docs/06: Employees, Import, HR overview, Candidates — ADR 019/020).
// Hand-written until the backend publishes these endpoints; then replace with generated
// aliases in src/api/types.ts, like the other screens.
import type { Band, Domain, Level } from '@/api/types'

export interface EmployeeSkill {
  skill_id: string
  skill_name: string
  proficiency: number
  years: number
  last_used: string
  certified: boolean
}

export interface EmployeeSummary {
  id: string
  employee_code: string
  full_name: string
  designation: string
  level: Level
  location: string
  cost_band: string
  current_allocation_pct: number
  available_from: string
  skill_count: number
}

export interface EmployeeDetail extends EmployeeSummary {
  practice: string
  years_experience: number
  timezone: string
  work_mode_preference: string
  client_clearances: string[]
  summary: string
  skills: EmployeeSkill[]
  projects: {
    project_name: string
    domain: Domain
    role_title: string
    start_date: string
    end_date: string
    outcome: string
  }[]
  leaves: { id: string; start_date: string; end_date: string }[]
}

export type EmployeeUpdate = Partial<
  Pick<
    EmployeeDetail,
    | 'designation'
    | 'level'
    | 'location'
    | 'timezone'
    | 'work_mode_preference'
    | 'cost_band'
    | 'current_allocation_pct'
    | 'available_from'
    | 'client_clearances'
  >
>

export type ImportKind = 'clients' | 'employees' | 'employee_skills'

export interface ImportPreview {
  preview_id: string
  kind: ImportKind
  columns: string[]
  rows: {
    row: number
    values: Record<string, string>
    action: 'create' | 'update'
    errors: string[]
  }[]
  valid: number
  invalid: number
}

export const CANDIDATE_STATUSES = [
  'new',
  'screened',
  'contacted',
  'interviewing',
  'hired',
  'not_taken',
] as const
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]

export interface CandidateProfile {
  designation: string
  level: Level
  years_experience: number
  location: string
  notice_days: number
  domains: Domain[]
  skills: Omit<EmployeeSkill, 'certified'>[]
  education: string[]
  summary: string
}

export interface CandidateSummary {
  id: string
  full_name: string
  designation: string
  level: Level
  years_experience: number
  location: string
  status: CandidateStatus
  source: string
  uploaded_at: string
  delete_after: string | null
  top_skills: string[]
  best_match: { task_code: string; score: number } | null
}

export interface CandidateDetail extends CandidateSummary {
  email: string | null
  phone: string | null
  consent_recorded_by: string
  consent_at: string
  profile: CandidateProfile
  history: { at: string; by: string; status: CandidateStatus; note: string }[]
}

export interface TaskMatch {
  task_id: string
  task_code: string
  title: string
  client_code: string
  score: number
  band: Band
  must_have_coverage: number
  matched_skills: string[]
  missing_skills: string[]
  reasons: string[]
}

export interface CandidateMatch extends Omit<
  TaskMatch,
  'task_id' | 'task_code' | 'title' | 'client_code'
> {
  candidate: CandidateSummary
}

export interface Extraction {
  extraction_id: string
  removed: string[]
  contact: { full_name?: string; email?: string; phone?: string }
  profile: CandidateProfile
  unmatched_skills: string[]
  notes: string[]
  model: string
}

export interface CandidateCreate {
  full_name: string
  email?: string
  phone?: string
  source: string
  consent: true
  profile: CandidateProfile
  extraction_id?: string
}

export interface HrSummary {
  open_tasks: number
  tasks_without_internal_fit: {
    task_id: string
    code: string
    title: string
    client_code: string
    best_internal_score: number | null
  }[]
  candidates_by_status: Partial<Record<CandidateStatus, number>>
  due_for_deletion_30d: number
  recent_candidates: CandidateSummary[]
}

export const STATUS_LABELS: Record<CandidateStatus, string> = {
  new: 'New',
  screened: 'Screened',
  contacted: 'Contacted',
  interviewing: 'Interviewing',
  hired: 'Hired',
  not_taken: 'Not taken',
}

// --- Hiring requests and notifications (docs/06, ADR 020 workflow) ------------------------

export const REQUEST_STATUSES = ['new', 'in_progress', 'sent', 'reviewed', 'closed'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]
export type Verdict = 'fit' | 'not_fit'
export const MAX_SUBMISSIONS = 10

export interface HiringRequestSummary {
  id: string
  task_id: string
  task_code: string
  task_title: string
  client_code: string
  requested_by: string
  requested_at: string
  wanted: number
  note: string
  status: RequestStatus
  sent_count: number
  fit_count: number
}

export interface Submission {
  candidate: {
    id: string
    first_name: string
    designation: string
    level: Level
    years_experience: number
    location: string
    notice_days: number
    profile: CandidateProfile
  }
  match: TaskMatch
  hr_note: string
  verdict: Verdict | null
  verdict_note: string
  decided_at: string | null
}

export interface HiringRequestDetail extends HiringRequestSummary {
  submissions: Submission[]
}

export interface AppNotification {
  id: string
  kind: 'request_new' | 'request_sent' | 'request_reviewed' | 'candidate_fit'
  title: string
  body: string
  link: string
  created_at: string
  read: boolean
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'Waiting for HR',
  in_progress: 'HR is searching',
  sent: 'Candidates sent',
  reviewed: 'Manager decided',
  closed: 'Closed',
}
