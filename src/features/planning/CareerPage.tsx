import { Printer } from 'lucide-react'
import { Navigate, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'
import { CareerPanel } from '@/features/planning/QualityPanels'

/** A printable development plan for a 1:1 (ADR 027). */
export default function CareerPage() {
  const { employeeId = '' } = useParams()
  const role = useAuth().user?.role
  if (role === 'viewer') return <Navigate to="/tasks" replace />
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          back={{ to: `/planning/people/${employeeId}`, label: 'Value card' }}
          title="Career plan"
          description="What to learn next, from the tasks the company actually needed in the last year."
          actions={
            <Button onClick={() => window.print()}>
              <Printer aria-hidden /> Print or save as PDF
            </Button>
          }
        />
      </div>
      <div className="mx-auto max-w-3xl">
        <CareerPanel employeeId={employeeId} printable />
      </div>
    </div>
  )
}
