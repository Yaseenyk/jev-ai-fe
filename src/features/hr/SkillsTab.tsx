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
            <li key={s.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground text-xs">
                {humanize(s.category)}
                {s.aliases.length > 0 && ` · also: ${s.aliases.join(', ')}`}
              </span>
            </li>
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
