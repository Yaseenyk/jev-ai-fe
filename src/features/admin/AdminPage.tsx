import { Navigate } from 'react-router'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EvalTab } from '@/features/admin/EvalTab'
import { RunsTab } from '@/features/admin/RunsTab'
import { ThresholdsTab } from '@/features/admin/ThresholdsTab'
import { useAuth } from '@/features/auth/AuthProvider'

export default function AdminPage() {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/tasks" replace />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">Admin</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Every matching run, the cut-offs that decide the bands, and how the model is doing.
        </p>
      </header>
      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="eval">Evaluation</TabsTrigger>
        </TabsList>
        <TabsContent value="runs" className="mt-5">
          <RunsTab />
        </TabsContent>
        <TabsContent value="thresholds" className="mt-5">
          <ThresholdsTab />
        </TabsContent>
        <TabsContent value="eval" className="mt-5">
          <EvalTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
