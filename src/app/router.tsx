import { Link, Navigate, createBrowserRouter } from 'react-router'

import { Layout } from '@/app/Layout'
import { EmptyState } from '@/components/QueryStates'
import AdminPage from '@/features/admin/AdminPage'
import { CHANGE_PASSWORD_PATH, RequireAuth, useAuth } from '@/features/auth/AuthProvider'
import ChangePasswordPage from '@/features/auth/ChangePasswordPage'
import CandidatePage from '@/features/hr/CandidatePage'
import CandidatesPage from '@/features/hr/CandidatesPage'
import EmployeePage from '@/features/hr/EmployeePage'
import CompanyPage from '@/features/hr/CompanyPage'
import HiringRequestPage from '@/features/hr/HiringRequestPage'
import HiringRequestsPage from '@/features/hr/HiringRequestsPage'
import HrHomePage from '@/features/hr/HrHomePage'
import ImportPage from '@/features/hr/ImportPage'
import TaskCandidatesPage from '@/features/hr/TaskCandidatesPage'
import UploadResumePage from '@/features/hr/UploadResumePage'
import LoginPage from '@/features/auth/LoginPage'
import NewTaskChatPage from '@/features/newTask/NewTaskChatPage'
import ClientProfilePage from '@/features/planning/ClientProfilePage'
import EmployeeValuePage from '@/features/planning/EmployeeValuePage'
import PlanningPage from '@/features/planning/PlanningPage'
import RunPage from '@/features/runs/RunPage'
import TaskDetailPage from '@/features/tasks/TaskDetailPage'
import TaskListPage from '@/features/tasks/TaskListPage'
import CareerPage from '@/features/planning/CareerPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import { FromRequestPage, PeopleSearchPage } from '@/features/workforce/Pages'
import { HelpPage, MyProfilePage, SavingsPage, SetupPage } from '@/features/workforce/MorePages'

/** HR start on their own queue; viewers, who cannot see bench cost, on the task board; everyone
 * else on the dashboard (ADR 028). */
function HomeRedirect() {
  const role = useAuth().user?.role
  return (
    <Navigate
      to={
        role === 'hr'
          ? '/hr'
          : role === 'viewer'
            ? '/tasks'
            : role === 'employee'
              ? '/me'
              : '/dashboard'
      }
      replace
    />
  )
}

export const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    path: CHANGE_PASSWORD_PATH,
    element: (
      <RequireAuth>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'tasks', element: <TaskListPage /> },
      { path: 'tasks/new', element: <NewTaskChatPage /> },
      { path: 'tasks/from-request', element: <FromRequestPage /> },
      { path: 'people/search', element: <PeopleSearchPage /> },
      { path: 'reports', element: <SavingsPage /> },
      { path: 'setup', element: <SetupPage /> },
      { path: 'me', element: <MyProfilePage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'tasks/:taskId', element: <TaskDetailPage /> },
      { path: 'tasks/:taskId/edit', element: <NewTaskChatPage /> },
      { path: 'runs/:runId', element: <RunPage /> },
      { path: 'planning', element: <PlanningPage /> },
      { path: 'planning/people/:employeeId', element: <EmployeeValuePage /> },
      { path: 'planning/people/:employeeId/profile', element: <ClientProfilePage /> },
      { path: 'planning/people/:employeeId/career', element: <CareerPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'company', element: <CompanyPage /> },
      { path: 'clients', element: <Navigate to="/company?tab=clients" replace /> },
      { path: 'hr', element: <HrHomePage /> },
      { path: 'hiring-requests', element: <HiringRequestsPage /> },
      { path: 'hiring-requests/:requestId', element: <HiringRequestPage /> },
      { path: 'candidates', element: <CandidatesPage /> },
      { path: 'candidates/new', element: <UploadResumePage /> },
      { path: 'candidates/:candidateId', element: <CandidatePage /> },
      { path: 'tasks/:taskId/candidates', element: <TaskCandidatesPage /> },
      { path: 'employees', element: <Navigate to="/company" replace /> },
      { path: 'employees/:employeeId', element: <EmployeePage /> },
      { path: 'import', element: <ImportPage /> },
      {
        path: '*',
        element: (
          <EmptyState title="Page not found">
            <Link to="/tasks" className="underline">
              Go to tasks
            </Link>
          </EmptyState>
        ),
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
