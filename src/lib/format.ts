import type { Band, Level, RejectReason, UserRole } from '@/api/types'

export const percent = (p: number): string => `${Math.round(p * 100)}%`

/** A probability: never shown as a certain 100% or 0% (scores near certainty saturate). */
export const chance = (p: number): string => (p >= 0.995 ? '>99%' : p <= 0.005 ? '<1%' : percent(p))

export const date = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export const humanize = (s: string): string =>
  s.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())

const DOMAIN_LABELS: Record<string, string> = { bfsi: 'BFSI', public_sector: 'Public sector' }
export const domainLabel = (d: string): string => DOMAIN_LABELS[d] ?? humanize(d)

const LOCATION_LABELS: Record<string, string> = {
  usa: 'USA',
  uk: 'UK',
  remote_india: 'Remote (India)',
}
export const locationLabel = (l: string): string => LOCATION_LABELS[l] ?? humanize(l)

export const LEVEL_TITLES: Record<Level, string> = {
  L1: 'Trainee',
  L2: 'Associate',
  L3: 'Engineer',
  L4: 'Senior',
  L5: 'Lead',
  L6: 'Principal',
}
export const levelLabel = (l: Level): string => `${LEVEL_TITLES[l]} (${l})`

export const BAND_LABELS: Record<Band, string> = {
  shortlist: 'Shortlist',
  review: 'Review',
  hidden: 'Hidden',
}

export const FILTER_REASON_LABELS: Record<string, string> = {
  not_available: 'Not available in time',
  leave_overlap: 'Leave overlaps the task',
  location_mismatch: 'Location does not fit',
  timezone_overlap: 'Too little timezone overlap',
  cost_band: 'Above the cost band',
  missing_clearance: 'Missing client clearance',
}

/** What a manager can change in the task when this rule removes most people. */
export const FILTER_REASON_FIXES: Record<string, string> = {
  not_available: 'Start later, allow part-time, or shorten the duration.',
  leave_overlap: 'Move the start date or shorten the duration.',
  location_mismatch: 'Allow another location, or make the role hybrid or remote.',
  timezone_overlap: 'Ask for fewer overlap hours with the client.',
  cost_band: 'Raise the maximum cost band.',
  missing_clearance: 'Drop the clearance requirement if the client allows it.',
}

export const FLAG_LABELS: Record<string, string> = {
  inconsistent: 'Answer changed when options were reordered',
  contradiction: 'AI answer contradicts the facts',
  low_confidence_format: 'AI gave an unclear answer',
  low_data: 'Very little profile data',
  inconsistent_data: 'Profile data is inconsistent',
  model_unsure: 'AI model is unsure about the overall fit',
}

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  skill_gap: 'Skill gap',
  level_mismatch: 'Level mismatch',
  availability: 'Availability',
  domain_gap: 'Domain gap',
  client_preference: 'Client preference',
  already_planned: 'Already planned elsewhere',
  other: 'Other',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  resource_manager: 'Resource manager',
  hr: 'HR',
  viewer: 'Viewer',
  employee: 'Employee (own profile)',
}
