import type { Band, Level, RejectReason } from '@/api/types'

export const percent = (p: number): string => `${Math.round(p * 100)}%`

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
export const levelLabel = (l: Level): string => `${l} · ${LEVEL_TITLES[l]}`

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

export const FLAG_LABELS: Record<string, string> = {
  inconsistent: 'Answer changed when options were reordered',
  contradiction: 'AI answer contradicts the facts',
  low_confidence_format: 'AI gave an unclear answer',
  low_data: 'Very little profile data',
  inconsistent_data: 'Profile data is inconsistent',
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
