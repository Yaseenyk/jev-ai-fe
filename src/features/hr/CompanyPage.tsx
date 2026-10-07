import { Navigate, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useManagesPeople } from '@/features/auth/AuthProvider'
import ClientsPage from '@/features/clients/ClientsPage'
import { EmployeesTab } from '@/features/hr/EmployeesPage'

/** HR's home for the company's own data: employees (with data health) and clients. */
export default function CompanyPage() {
  const allowed = useManagesPeople()
  const [params, setParams] = useSearchParams()
  if (!allowed) return <Navigate to="/tasks" replace />
  const tab = params.get('tab') === 'clients' ? 'clients' : 'employees'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company"
        description="Your people and your clients: the information every match is built on."
      />
      <Tabs value={tab} onValueChange={(t) => setParams(t === 'clients' ? { tab: t } : {})}>
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="mt-4">
          <EmployeesTab />
        </TabsContent>
        <TabsContent value="clients" className="mt-4">
          <ClientsPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
