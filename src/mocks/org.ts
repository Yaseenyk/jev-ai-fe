import { HttpResponse, http } from 'msw'

import type { BusinessUnit, BusinessUnitRef, HeadOption } from '@/api/types'

const api = (path: string) => `*/api/v1${path}`

const HEADS: HeadOption[] = [
  { id: 'm1', display_name: 'Resource Manager 1', email: 'manager1@srtm.local' },
  { id: 'm2', display_name: 'Resource Manager 2', email: 'manager2@srtm.local' },
]

const units: BusinessUnit[] = [
  {
    id: 'bu-1',
    code: 'BU001',
    name: 'Data & AI',
    head_user_id: 'm1',
    head_name: 'Resource Manager 1',
    head_email: 'manager1@srtm.local',
    employees: 0,
  },
  {
    id: 'bu-2',
    code: 'BU002',
    name: 'Apps & QA',
    head_user_id: 'm2',
    head_name: 'Resource Manager 2',
    head_email: 'manager2@srtm.local',
    employees: 0,
  },
]

const ref = (u: BusinessUnit): BusinessUnitRef => ({
  code: u.code,
  name: u.name,
  head_name: u.head_name,
  head_email: u.head_email,
})

/** Mock people alternate between the two units, the same way every time. */
export function unitFor(employeeId: string): BusinessUnitRef {
  let sum = 0
  for (let i = 0; i < employeeId.length; i++) sum += employeeId.charCodeAt(i)
  return ref(units[sum % 2] as BusinessUnit)
}

export function createOrgHandlers(currentUser: () => { email: string; role: string }) {
  return [
    http.get(api('/business-units'), () => HttpResponse.json(units)),
    http.get(api('/business-units/mine'), () => {
      const mine = units.find((u) => u.head_email === currentUser().email)
      return HttpResponse.json({ unit: mine ? ref(mine) : null })
    }),
    http.get(api('/business-units/heads'), () => HttpResponse.json(HEADS)),
    http.post(api('/business-units'), async ({ request }) => {
      const body = (await request.json()) as {
        code: string
        name: string
        head_user_id: string | null
      }
      const code = body.code.toUpperCase()
      if (units.some((u) => u.code === code)) {
        return HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Exists',
            status: 409,
            code: 'unit_exists',
            detail: `${code} already exists`,
          },
          { status: 409 },
        )
      }
      const head = HEADS.find((h) => h.id === body.head_user_id)
      const made: BusinessUnit = {
        id: `bu-${units.length + 1}`,
        code,
        name: body.name,
        head_user_id: head?.id ?? null,
        head_name: head?.display_name ?? null,
        head_email: head?.email ?? null,
        employees: 0,
      }
      units.push(made)
      return HttpResponse.json(made, { status: 201 })
    }),
    http.patch(api('/business-units/:id'), async ({ params, request }) => {
      const body = (await request.json()) as { name?: string; head_user_id?: string | null }
      const u = units.find((x) => x.id === params.id)
      if (!u) return HttpResponse.json({ code: 'unit_not_found' }, { status: 404 })
      if (body.name) u.name = body.name
      if ('head_user_id' in body) {
        const head = HEADS.find((h) => h.id === body.head_user_id)
        u.head_user_id = head?.id ?? null
        u.head_name = head?.display_name ?? null
        u.head_email = head?.email ?? null
      }
      return HttpResponse.json(u)
    }),
  ]
}
