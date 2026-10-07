import { Navigate, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EvalTab } from '@/features/admin/EvalTab'
import { HealthTab } from '@/features/admin/HealthTab'
import { LearningTab } from '@/features/admin/LearningTab'
import { ModelsTab } from '@/features/admin/ModelsTab'
import { RunsTab } from '@/features/admin/RunsTab'
import { ThresholdsTab } from '@/features/admin/ThresholdsTab'
import { UsersTab } from '@/features/admin/UsersTab'
import { useAuth } from '@/features/auth/AuthProvider'

const TABS = [
  { value: 'runs', label: 'Runs', body: <RunsTab /> },
  { value: 'thresholds', label: 'Thresholds', body: <ThresholdsTab /> },
  { value: 'eval', label: 'Test reports', body: <EvalTab /> },
  { value: 'health', label: 'Health', body: <HealthTab /> },
  { value: 'learning', label: 'Learning', body: <LearningTab /> },
  { value: 'models', label: 'Models', body: <ModelsTab /> },
  { value: 'users', label: 'Users', body: <UsersTab /> },
]

export default function AdminPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  if (user?.role !== 'admin') return <Navigate to="/tasks" replace />
  const asked = params.get('tab')
  const tab = TABS.some((t) => t.value === asked) ? (asked as string) : 'runs'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Watch every matching run, set the cut-offs that decide who is shown, check how the model is doing, and manage who can sign in."
      />
      <Tabs
        value={tab}
        onValueChange={(t) => setParams(t === 'runs' ? {} : { tab: t }, { replace: true })}
      >
        <div className="overflow-x-auto border-b">
          <TabsList variant="line" className="gap-5 p-0 group-data-horizontal/tabs:h-10">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="data-[state=active]:border-b-primary data-[state=active]:text-foreground h-10 flex-none rounded-none border-0 border-b-2 border-transparent px-1 after:hidden"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            {t.body}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
