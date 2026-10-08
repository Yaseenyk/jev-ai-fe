import { Calculator, Loader2, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { CostBand, Level, WhatIfIn } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSkills } from '@/features/newTask/api'
import { MarginBadge, usd } from '@/features/planning/PlanningPage'
import { useWhatIf } from '@/features/planning/insightsApi'
import { percent } from '@/lib/format'
import { UnitBadge } from '@/features/org/UnitBadge'

const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']
const BANDS: CostBand[] = ['A', 'B', 'C', 'D', 'E']

interface RoleDraft {
  title: string
  people: number
  level: Level
  band: CostBand
  skills: string[]
}

const SELECT =
  'border-input bg-background h-9 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none'

function inDays(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
}

/** "If we win this project, can we staff it from inside?" (ADR 025). Rules only. */
export function WhatIfTab() {
  const skills = useSkills()
  const whatIf = useWhatIf()
  const [start, setStart] = useState(inDays(45))
  const [weeks, setWeeks] = useState(12)
  const [roles, setRoles] = useState<RoleDraft[]>([
    { title: 'Data engineer', people: 2, level: 'L4', band: 'D', skills: [] },
  ])
  const edit = (i: number, change: Partial<RoleDraft>) =>
    setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, ...change } : r)))
  const ready = roles.every((r) => r.title.trim().length >= 2 && r.skills.length > 0)

  const run = () => {
    const body: WhatIfIn = {
      start_date: start,
      weeks,
      roles: roles.map((r) => ({
        title: r.title.trim(),
        people: r.people,
        required_level: r.level,
        max_cost_band: r.band,
        allocation_pct: 100,
        skills: r.skills.map((id) => ({ skill_id: id, min_proficiency: 3, must_have: true })),
      })),
    }
    whatIf.mutate(body)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <section className="bg-surface space-y-4 rounded-xl border p-4" aria-label="Project to test">
        <h2 className="text-sm font-semibold">The project you might win</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wi-start">Starts</Label>
            <Input
              id="wi-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wi-weeks">Weeks</Label>
            <Input
              id="wi-weeks"
              type="number"
              min={1}
              max={104}
              value={weeks}
              onChange={(e) => setWeeks(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
        {roles.map((r, i) => (
          <fieldset
            key={i}
            className="space-y-2 rounded-lg border p-3"
            aria-label={`Role ${i + 1}`}
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Role ${i + 1} title`}
                value={r.title}
                onChange={(e) => edit(i, { title: e.target.value })}
              />
              {roles.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove role ${i + 1}`}
                  onClick={() => setRoles((rs) => rs.filter((_, j) => j !== i))}
                >
                  <X aria-hidden />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="text-xs">
                People{' '}
                <Input
                  type="number"
                  min={1}
                  max={10}
                  aria-label={`Role ${i + 1} people`}
                  className="inline-block h-9 w-16"
                  value={r.people}
                  onChange={(e) =>
                    edit(i, { people: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })
                  }
                />
              </label>
              <label className="text-xs">
                Level{' '}
                <select
                  className={SELECT}
                  aria-label={`Role ${i + 1} level`}
                  value={r.level}
                  onChange={(e) => edit(i, { level: e.target.value as Level })}
                >
                  {LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Up to band{' '}
                <select
                  className={SELECT}
                  aria-label={`Role ${i + 1} band`}
                  value={r.band}
                  onChange={(e) => edit(i, { band: e.target.value as CostBand })}
                >
                  {BANDS.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-1">
              <select
                className={`${SELECT} w-full`}
                aria-label={`Role ${i + 1} add skill`}
                value=""
                onChange={(e) => {
                  const id = e.target.value
                  if (id && !r.skills.includes(id)) edit(i, { skills: [...r.skills, id] })
                }}
              >
                <option value="">Add a must-have skill…</option>
                {(skills.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1">
                {r.skills.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="bg-muted rounded-full px-2 py-0.5 text-xs"
                    onClick={() => edit(i, { skills: r.skills.filter((x) => x !== id) })}
                    aria-label={`Remove ${skills.data?.find((s) => s.id === id)?.name ?? 'skill'}`}
                  >
                    {skills.data?.find((s) => s.id === id)?.name ?? id} ×
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setRoles((rs) => [
                ...rs,
                { title: '', people: 1, level: 'L3', band: 'C', skills: [] },
              ])
            }
            disabled={roles.length >= 10}
          >
            <Plus aria-hidden /> Add role
          </Button>
          <Button onClick={run} disabled={!ready || whatIf.isPending}>
            {whatIf.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Calculator aria-hidden />
            )}
            Can we staff it?
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          A quick check by the rules (skills at level 3+, level, band, free time at the start). No
          task is created. Run matching on real tasks for the ranked shortlist.
        </p>
      </section>

      <section className="space-y-3" aria-label="What-if result">
        {whatIf.isError && <ErrorState error={whatIf.error} />}
        {!whatIf.data && !whatIf.isError && (
          <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            Describe the roles, then choose “Can we staff it?”.
          </div>
        )}
        {whatIf.data && (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="bg-surface rounded-xl border p-4">
                <dt className="text-muted-foreground text-sm">Staffed from inside</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {whatIf.data.staffed} of {whatIf.data.wanted}
                </dd>
              </div>
              <div className="bg-surface rounded-xl border p-4">
                <dt className="text-muted-foreground text-sm">Billing per week</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {usd(whatIf.data.weekly_revenue_usd)}
                </dd>
              </div>
              <div className="bg-surface rounded-xl border p-4">
                <dt className="text-muted-foreground text-sm">Margin per week</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {usd(whatIf.data.weekly_margin_usd)}
                </dd>
              </div>
            </dl>
            <ul className="space-y-3">
              {whatIf.data.roles.map((r, i) => (
                <li key={i} className="bg-surface rounded-xl border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{r.title}</span>
                    <StatusBadge tone={r.to_hire === 0 ? 'ready' : 'attention'}>
                      {r.proposed.length} of {r.wanted} from inside
                    </StatusBadge>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {r.proposed.map((p) => (
                      <li key={p.employee_id} className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/planning/people/${p.employee_id}`}
                          className="font-medium hover:underline"
                        >
                          {p.full_name}
                        </Link>
                        <span className="text-muted-foreground text-xs">
                          {p.level} · {percent(p.must_have_coverage)} of must-haves
                        </span>
                        <UnitBadge unit={p.business_unit} />
                        <MarginBadge margin={p.margin} />
                      </li>
                    ))}
                  </ul>
                  {r.to_hire > 0 && (
                    <p className="mt-2 text-sm">
                      Hire {r.to_hire}
                      {r.missing_skills.length > 0 &&
                        `: nobody free has ${r.missing_skills.join(', ')}`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
