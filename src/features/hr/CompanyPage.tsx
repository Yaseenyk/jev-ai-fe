import { Navigate, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import ClientsPage from '@/features/clients/ClientsPage'
import { EmployeesTab } from '@/features/hr/EmployeesPage'
import { BusinessUnitsTab } from '@/features/org/BusinessUnitsTab'
import { SkillsTab } from '@/features/hr/SkillsTab'
import { DataQualityCard } from '@/features/planning/QualityPanels'

/** HR's home for the company's own data: employees (with data health) and clients. */
export default function CompanyPage() {
  const allowed = useManagesPeople()
  const [params, setParams] = useSearchParams()
  if (!allowed) return <Navigate to="/tasks" replace />
  const asked = params.get('tab')
  const tab = asked === 'clients' || asked === 'units' || asked === 'skills' ? asked : 'employees'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company"
        description="Your people and your clients: the information every match is built on."
      />
      <Tabs value={tab} onValueChange={(t) => setParams(t === 'employees' ? {} : { tab: t })}>
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="units">Business units</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="mt-4">
          <div className="space-y-6">
            <DataQualityCard />
            <EmployeesTab />
          </div>
        </TabsContent>
        <TabsContent value="clients" className="mt-4">
          <ClientsPage />
        </TabsContent>
        <TabsContent value="units" className="mt-4">
          <BusinessUnitsTab />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <SkillsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
