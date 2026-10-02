import { z } from 'zod'

import type { Level, TaskCreate, TaskPriority } from '@/api/types'
import { LEVEL_TITLES, domainLabel, locationLabel } from '@/lib/format'

/** Everything the chat collects. Undefined = not answered yet. */
export interface Draft {
  title?: string
  client_code?: string
  domain?: string
  required_level?: Level
  min_years_experience?: number
  must_skills?: string[]
  must_min_proficiency?: number
  nice_skills?: string[]
  description?: string
  start_date?: string
  duration_weeks?: number
  allocation_pct_required?: number
  work_mode?: string
  location?: string
  client_timezone?: string
  min_timezone_overlap_hours?: number
  max_cost_band?: string
  clearance?: 'none' | 'client'
  priority?: TaskPriority
}

export interface Option {
  value: string
  label: string
  hint?: string
}

interface Base {
  id: keyof Draft
  prompt: (d: Draft) => string
  /** Steps that don't apply (e.g. location for remote work) are skipped. */
  skip?: (d: Draft) => boolean
}

export type Step =
  | (Base & { kind: 'text'; placeholder: string; schema: z.ZodType<string>; optional?: boolean })
  | (Base & {
      kind: 'choice'
      options: (d: Draft, today: Date) => Option[]
      /** Lets the user type a value not in the options. */
      other?: { label: string; inputType: 'text' | 'date'; schema: z.ZodType<string> }
    })
  | (Base & { kind: 'skills'; optional: boolean })

const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

const DOMAINS = [
  'bfsi',
  'healthcare',
  'retail',
  'manufacturing',
  'public_sector',
  'education',
  'telecom',
  'logistics',
]
const LOCATIONS = ['hyderabad', 'bengaluru', 'pune', 'chennai', 'remote_india', 'usa', 'uk']

export function steps(clients: string[]): Step[] {
  return [
    {
      id: 'title',
      kind: 'text',
      prompt: () => "Hi! Let's set up a new task. What's the role title?",
      placeholder: 'e.g. Senior Data Engineer for claims migration',
      schema: z
        .string()
        .trim()
        .min(5, 'Use at least 5 characters')
        .max(120, 'Keep it under 120 characters'),
    },
    {
      id: 'client_code',
      kind: 'choice',
      prompt: () => 'Which client is this for?',
      options: () => clients.map((c) => ({ value: c, label: c })),
      other: {
        label: 'Another client',
        inputType: 'text',
        schema: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9-]{2,20}$/, 'Use 2–20 letters, digits or dashes, e.g. CL-ACME'),
      },
    },
    {
      id: 'domain',
      kind: 'choice',
      prompt: () => 'Which business domain is it in?',
      options: () => DOMAINS.map((d) => ({ value: d, label: domainLabel(d) })),
    },
    {
      id: 'required_level',
      kind: 'choice',
      prompt: () => 'What level do you need?',
      options: () =>
        (['L2', 'L3', 'L4', 'L5', 'L6'] as const).map((l) => ({
          value: l,
          label: `${l} · ${LEVEL_TITLES[l]}`,
        })),
    },
    {
      id: 'min_years_experience',
      kind: 'choice',
      prompt: () => 'Minimum years of experience?',
      options: () => [
        { value: '0', label: 'No minimum' },
        { value: '1', label: '1+ years' },
        { value: '3', label: '3+ years' },
        { value: '5', label: '5+ years' },
        { value: '8', label: '8+ years' },
      ],
    },
    {
      id: 'must_skills',
      kind: 'skills',
      optional: false,
      prompt: () => 'Which skills are a must-have? Type to search and pick one or more.',
    },
    {
      id: 'must_min_proficiency',
      kind: 'choice',
      prompt: () => 'What minimum proficiency do they need in those skills?',
      options: () => [
        { value: '2', label: '2 · Beginner' },
        { value: '3', label: '3 · Working' },
        { value: '4', label: '4 · Advanced' },
        { value: '5', label: '5 · Expert' },
      ],
    },
    {
      id: 'nice_skills',
      kind: 'skills',
      optional: true,
      prompt: () => 'Any nice-to-have skills? You can skip this.',
    },
    {
      id: 'start_date',
      kind: 'choice',
      prompt: () => 'When should they start?',
      options: (_d, today) => [
        { value: isoDate(today), label: 'As soon as possible' },
        { value: isoDate(addDays(today, 14)), label: 'In 2 weeks' },
        { value: isoDate(addDays(today, 30)), label: 'In a month' },
      ],
      other: {
        label: 'Pick a date',
        inputType: 'date',
        schema: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
      },
    },
    {
      id: 'duration_weeks',
      kind: 'choice',
      prompt: () => 'For how long?',
      options: () => [4, 8, 12, 24, 52].map((w) => ({ value: String(w), label: `${w} weeks` })),
    },
    {
      id: 'allocation_pct_required',
      kind: 'choice',
      prompt: () => 'Full-time or part-time on this task?',
      options: () => [
        { value: '100', label: 'Full-time (100%)' },
        { value: '50', label: 'Part-time (50%)' },
      ],
    },
    {
      id: 'work_mode',
      kind: 'choice',
      prompt: () => 'What work mode?',
      options: () => [
        { value: 'onsite', label: 'Onsite' },
        { value: 'hybrid', label: 'Hybrid' },
        { value: 'remote', label: 'Remote' },
      ],
    },
    {
      id: 'location',
      kind: 'choice',
      prompt: () => 'Where should they be based?',
      skip: (d) => d.work_mode === 'remote',
      options: () => [
        { value: 'any', label: 'Anywhere' },
        ...LOCATIONS.map((l) => ({ value: l, label: locationLabel(l) })),
      ],
    },
    {
      id: 'client_timezone',
      kind: 'choice',
      prompt: () => "What's the client's timezone?",
      options: () => [
        { value: 'Asia/Kolkata', label: 'India (IST)' },
        { value: 'America/New_York', label: 'US East' },
        { value: 'Europe/London', label: 'UK' },
      ],
    },
    {
      id: 'min_timezone_overlap_hours',
      kind: 'choice',
      prompt: () => 'How many working hours must overlap with the client?',
      options: () => [
        { value: '0', label: 'No overlap needed' },
        { value: '2', label: '2 hours' },
        { value: '3', label: '3 hours' },
        { value: '4', label: '4 hours' },
      ],
    },
    {
      id: 'max_cost_band',
      kind: 'choice',
      prompt: () => "What's the highest cost band you can take?",
      options: () =>
        ['A', 'B', 'C', 'D', 'E'].map((b, i) => ({
          value: b,
          label: `Band ${b}`,
          ...(i === 0 ? { hint: 'lowest' } : i === 4 ? { hint: 'highest' } : {}),
        })),
    },
    {
      id: 'clearance',
      kind: 'choice',
      prompt: (d) => `Does the person need ${d.client_code ?? 'the client'}'s clearance?`,
      options: () => [
        { value: 'none', label: 'No' },
        { value: 'client', label: 'Yes' },
      ],
    },
    {
      id: 'priority',
      kind: 'choice',
      prompt: () => 'How urgent is this?',
      options: () => [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
    },
    {
      id: 'description',
      kind: 'text',
      optional: true,
      prompt: () =>
        'Anything else the matching should know? A short description helps. You can skip this.',
      placeholder: 'e.g. Migrating claims data from on-prem SQL Server to Snowflake',
      schema: z.string().trim().max(500, 'Keep it under 500 characters'),
    },
  ]
}

export interface Stage {
  id: string
  label: string
  fields: (keyof Draft)[]
}

/** Questions grouped into stages, so progress reads as "Role, Skills, …" instead of "6 of 19". */
export const STAGES: Stage[] = [
  {
    id: 'role',
    label: 'Role',
    fields: ['title', 'client_code', 'domain', 'required_level', 'min_years_experience'],
  },
  { id: 'skills', label: 'Skills', fields: ['must_skills', 'must_min_proficiency', 'nice_skills'] },
  {
    id: 'timing',
    label: 'Timing',
    fields: ['start_date', 'duration_weeks', 'allocation_pct_required'],
  },
  {
    id: 'limits',
    label: 'Location & limits',
    fields: [
      'work_mode',
      'location',
      'client_timezone',
      'min_timezone_overlap_hours',
      'max_cost_band',
      'clearance',
      'priority',
    ],
  },
  { id: 'notes', label: 'Notes', fields: ['description'] },
]

export const FIELD_LABELS: Record<keyof Draft, string> = {
  title: 'Title',
  client_code: 'Client',
  domain: 'Domain',
  required_level: 'Level',
  min_years_experience: 'Experience',
  must_skills: 'Must-have skills',
  must_min_proficiency: 'Min proficiency',
  nice_skills: 'Nice-to-have',
  start_date: 'Start',
  duration_weeks: 'Duration',
  allocation_pct_required: 'Allocation',
  work_mode: 'Work mode',
  location: 'Location',
  client_timezone: 'Client timezone',
  min_timezone_overlap_hours: 'Overlap',
  max_cost_band: 'Max cost band',
  clearance: 'Clearance',
  priority: 'Priority',
  description: 'Notes',
}

export const isAnswered = (d: Draft, id: keyof Draft) => d[id] !== undefined

/** The first step after `from` that applies and is unanswered; null means show the summary. */
export function nextStep(all: Step[], d: Draft, from = -1): number | null {
  for (let i = from + 1; i < all.length; i++) {
    const s = all[i]
    if (s && !s.skip?.(d) && !isAnswered(d, s.id)) return i
  }
  for (let i = 0; i <= from && i < all.length; i++) {
    const s = all[i]
    if (s && !s.skip?.(d) && !isAnswered(d, s.id)) return i
  }
  return null
}

const NUMERIC: (keyof Draft)[] = [
  'min_years_experience',
  'must_min_proficiency',
  'duration_weeks',
  'allocation_pct_required',
  'min_timezone_overlap_hours',
]

/** Store a raw answer string under the right type for its field. */
export function applyAnswer(d: Draft, id: keyof Draft, value: string | string[]): Draft {
  if (Array.isArray(value)) return { ...d, [id]: value }
  return { ...d, [id]: NUMERIC.includes(id) ? Number(value) : value }
}

export function toTaskCreate(d: Draft): TaskCreate {
  const required = <K extends keyof Draft>(k: K): NonNullable<Draft[K]> => {
    const v = d[k]
    if (v === undefined) throw new Error(`missing answer: ${k}`)
    return v
  }
  const minProf = required('must_min_proficiency')
  const clientCode = required('client_code')
  return {
    title: required('title'),
    description: d.description ?? '',
    client_code: clientCode,
    domain: required('domain'),
    required_level: required('required_level'),
    min_years_experience: required('min_years_experience'),
    location_constraint:
      d.work_mode === 'remote' || !d.location || d.location === 'any' ? [] : [d.location],
    work_mode: required('work_mode'),
    client_timezone: required('client_timezone'),
    min_timezone_overlap_hours: required('min_timezone_overlap_hours'),
    start_date: required('start_date'),
    duration_weeks: required('duration_weeks'),
    allocation_pct_required: required('allocation_pct_required'),
    max_cost_band: required('max_cost_band'),
    clearance_required: d.clearance === 'client' ? clientCode : null,
    priority: required('priority'),
    requirements: [
      ...required('must_skills').map((id) => ({
        skill_id: id,
        min_proficiency: minProf,
        must_have: true,
      })),
      ...(d.nice_skills ?? []).map((id) => ({
        skill_id: id,
        min_proficiency: 2,
        must_have: false,
      })),
    ],
  }
}
