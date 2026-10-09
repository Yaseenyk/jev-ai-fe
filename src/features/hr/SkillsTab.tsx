import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

import { apiFetch } from '@/api/client'
import type { Page, Skill } from '@/api/types'
import { ErrorState } from '@/components/QueryStates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { humanize } from '@/lib/format'

const CATEGORIES = [
  'language',
  'framework',
  'cloud',
  'data',
  'ai_ml',
  'devops',
  'testing',
  'domain',
  'soft',
] as const

/** HR finds a skill in the shared list or adds one it is missing (ADR 027). */
export function SkillsTab() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('framework')
  const [aliases, setAliases] = useState('')
  const found = useQuery({
    queryKey: ['skills', 'search', q],
    queryFn: () =>
      apiFetch<Page<Skill>>(
        `/skills?limit=50${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`,
      ),
  })
  const add = useMutation({
    mutationFn: () =>
      apiFetch<Skill>('/skills', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          category,
          aliases: aliases
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: (made) => {
      setQ(made.name)
      setName('')
      setAliases('')
      void qc.invalidateQueries({ queryKey: ['skills'] })
    },
  })

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-2xl text-sm">
        The skills list is shared by matching, imports and resumes. Search before adding: a new
        skill is available to everyone straight away, and other names for it can go in as aliases.
      </p>
      <form
        aria-label="Add a skill"
        className="bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault()
          add.mutate()
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="skill-name">Skill</Label>
          <Input
            id="skill-name"
            className="w-48"
            placeholder="e.g. Qwik"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="skill-category">Category</Label>
          <select
            id="skill-category"
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="skill-aliases">Other names (comma separated)</Label>
          <Input
            id="skill-aliases"
            className="w-64"
            placeholder="e.g. qwikjs, qwik city"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!name.trim() || add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          Add skill
        </Button>
        {add.isError && (
          <div className="w-full">
            <ErrorState error={add.error} />
          </div>
        )}
      </form>
      <div className="space-y-2">
        <Input
          aria-label="Search skills"
          placeholder="Search the skills list"
          className="max-w-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {found.isError && <ErrorState error={found.error} />}
        <ul className="divide-y rounded-xl border" aria-label="Skills">
          {(found.data?.items ?? []).map((s) => (
            <SkillRow key={s.id} skill={s} />
          ))}
        </ul>
        {found.data && (
          <p className="text-muted-foreground text-xs">
            {found.data.total} skill{found.data.total === 1 ? '' : 's'}
            {found.data.total > found.data.items.length && ', showing the first 50'}
          </p>
        )}
      </div>
    </div>
  )
}

/** One skill, with a way to add the other names people use for it (ADR 030). */
function SkillRow({ skill }: { skill: Skill }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState('')
  const add = useMutation({
    mutationFn: () =>
      apiFetch<Skill>(`/skills/${skill.id}/aliases`, {
        method: 'POST',
        body: JSON.stringify({
          aliases: names
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      setNames('')
      setOpen(false)
      void qc.invalidateQueries({ queryKey: ['skills'] })
    },
  })
  return (
    <li className="space-y-2 px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{skill.name}</span>
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          {humanize(skill.category)}
          {skill.aliases.length > 0 && ` · also: ${skill.aliases.join(', ')}`}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            Add other names
          </Button>
        </span>
      </div>
      {open && (
        <form
          aria-label={`Other names for ${skill.name}`}
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add.mutate()
          }}
        >
          <Input
            aria-label={`Other names for ${skill.name} (comma separated)`}
            className="h-8 w-72"
            placeholder="e.g. RESTful APIs, Web API"
            value={names}
            onChange={(e) => setNames(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={!names.trim() || add.isPending}>
            Save names
          </Button>
          {add.isError && (
            <div className="w-full">
              <ErrorState error={add.error} />
            </div>
          )}
        </form>
      )}
    </li>
  )
}
