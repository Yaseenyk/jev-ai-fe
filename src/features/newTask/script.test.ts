import type { Skill } from '@/api/types'
import { matchSkills } from '@/features/newTask/ChatInputs'
import type { InterpretResponse } from '@/api/types'
import {
  type Draft,
  applyAnswer,
  fromInterpretation,
  nextStep,
  steps,
  toTaskCreate,
} from '@/features/newTask/script'

const all = steps(['CL-ACME'])
const indexOf = (id: keyof Draft) => all.findIndex((s) => s.id === id)

const complete: Draft = {
  title: 'Senior Data Engineer',
  client_code: 'CL-ACME',
  domain: 'bfsi',
  required_level: 'L4',
  min_years_experience: 5,
  must_skills: ['s1', 's2'],
  must_min_proficiency: 3,
  nice_skills: ['s3'],
  description: '',
  start_date: '2026-10-15',
  duration_weeks: 12,
  allocation_pct_required: 100,
  work_mode: 'hybrid',
  location: 'hyderabad',
  client_timezone: 'Asia/Kolkata',
  min_timezone_overlap_hours: 2,
  max_cost_band: 'C',
  clearance: 'client',
  priority: 'high',
}

test('questions are asked in order, starting with the role title', () => {
  expect(nextStep(all, {})).toBe(0)
  expect(nextStep(all, applyAnswer({}, 'title', 'Senior Data Engineer'), 0)).toBe(1)
})

test('location is skipped for remote work', () => {
  const draft: Draft = { ...complete, location: undefined, work_mode: 'remote' }
  expect(nextStep(all, draft, indexOf('work_mode'))).toBeNull()
  expect(nextStep(all, { ...draft, work_mode: 'onsite' }, indexOf('work_mode'))).toBe(
    indexOf('location'),
  )
})

test('editing an earlier answer returns to the summary when nothing else is missing', () => {
  const edited = applyAnswer(complete, 'domain', 'retail')
  expect(nextStep(all, edited, indexOf('domain'))).toBeNull()
})

test('numeric answers are stored as numbers', () => {
  expect(applyAnswer({}, 'duration_weeks', '24').duration_weeks).toBe(24)
  expect(applyAnswer({}, 'title', '24').title).toBe('24')
})

test('answers map to the task API shape', () => {
  const t = toTaskCreate(complete)
  expect(t.location_constraint).toEqual(['hyderabad'])
  expect(t.clearance_required).toBe('CL-ACME')
  expect(t.requirements).toEqual([
    { skill_id: 's1', min_proficiency: 3, must_have: true },
    { skill_id: 's2', min_proficiency: 3, must_have: true },
    { skill_id: 's3', min_proficiency: 2, must_have: false },
  ])
  expect(toTaskCreate({ ...complete, work_mode: 'remote' }).location_constraint).toEqual([])
  expect(toTaskCreate({ ...complete, location: 'any' }).location_constraint).toEqual([])
  expect(toTaskCreate({ ...complete, clearance: 'none' }).clearance_required).toBeNull()
})

test('a missing answer cannot be turned into a task', () => {
  expect(() => toTaskCreate({ ...complete, priority: undefined })).toThrow('priority')
})

test('skill search matches names and aliases, prefix matches first', () => {
  const skills: Skill[] = [
    { id: '1', name: 'React Native', category: 'framework', aliases: [] },
    { id: '2', name: 'React', category: 'framework', aliases: ['reactjs', 'react.js'] },
    { id: '3', name: 'Preact', category: 'framework', aliases: [] },
  ]
  expect(matchSkills(skills, 'react', new Set()).map((s) => s.name)).toEqual([
    'React Native',
    'React',
    'Preact',
  ])
  expect(matchSkills(skills, 'reactjs', new Set()).map((s) => s.id)).toEqual(['2'])
  expect(matchSkills(skills, 'react', new Set(['2'])).map((s) => s.id)).toEqual(['1', '3'])
})

const empty: InterpretResponse = {
  title: null,
  client_code: null,
  domain: null,
  required_level: null,
  min_years_experience: null,
  must_skills: [],
  nice_skills: [],
  start_in_days: null,
  duration_weeks: null,
  allocation_pct_required: null,
  work_mode: null,
  location: null,
  priority: null,
  unmatched_skills: [],
  notes: [],
  model: 'm',
}

test('interpreted values snap onto the chat options and unknowns stay unanswered', () => {
  const d = fromInterpretation(
    {
      ...empty,
      client_code: 'CL-OTHER',
      required_level: 'L1',
      min_years_experience: 6,
      duration_weeks: 26,
      allocation_pct_required: 60,
      start_in_days: 14,
      work_mode: 'remote',
      location: 'hyderabad',
    },
    ['CL-ACME'],
    new Date('2026-10-02T09:00:00Z'),
  )
  expect(d).toEqual({
    required_level: 'L2',
    min_years_experience: 5,
    duration_weeks: 24,
    allocation_pct_required: 50,
    start_date: '2026-10-16',
    work_mode: 'remote',
  })
  expect(fromInterpretation(empty, [], new Date())).toEqual({})
})
