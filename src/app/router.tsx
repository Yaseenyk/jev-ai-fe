import { lazy } from 'react'
import { Link, Navigate, createBrowserRouter } from 'react-router'

import { Layout } from '@/app/Layout'
import { EmptyState } from '@/components/QueryStates'
import { CHANGE_PASSWORD_PATH, RequireAuth, useAuth } from '@/features/auth/AuthProvider'
import ChangePasswordPage from '@/features/auth/ChangePasswordPage'
import HrHomePage from '@/features/hr/HrHomePage'
import LoginPage from '@/features/auth/LoginPage'
import TaskListPage from '@/features/tasks/TaskListPage'
import DashboardPage from '@/features/dashboard/DashboardPage'

// Opened less often: each loads on first visit, so the first screen comes up faster.
const AdminPage = lazy(() => import('@/features/admin/AdminPage'))
const CandidatePage = lazy(() => import('@/features/hr/CandidatePage'))
const CandidatesPage = lazy(() => import('@/features/hr/CandidatesPage'))
const EmployeePage = lazy(() => import('@/features/hr/EmployeePage'))
const CompanyPage = lazy(() => import('@/features/hr/CompanyPage'))
const HiringRequestPage = lazy(() => import('@/features/hr/HiringRequestPage'))
const HiringRequestsPage = lazy(() => import('@/features/hr/HiringRequestsPage'))
const ImportPage = lazy(() => import('@/features/hr/ImportPage'))
const TaskCandidatesPage = lazy(() => import('@/features/hr/TaskCandidatesPage'))
const UploadResumePage = lazy(() => import('@/features/hr/UploadResumePage'))
const NewTaskChatPage = lazy(() => import('@/features/newTask/NewTaskChatPage'))
const ClientProfilePage = lazy(() => import('@/features/planning/ClientProfilePage'))
const EmployeeValuePage = lazy(() => import('@/features/planning/EmployeeValuePage'))
const PlanningPage = lazy(() => import('@/features/planning/PlanningPage'))
const TeamBuilderPage = lazy(() => import('@/features/teams/TeamBuilderPage'))
const RunPage = lazy(() => import('@/features/runs/RunPage'))
const TaskDetailPage = lazy(() => import('@/features/tasks/TaskDetailPage'))
const CareerPage = lazy(() => import('@/features/planning/CareerPage'))
const TeamPage = lazy(() =>
  import('@/features/teams/TeamPages').then((m) => ({ default: m.TeamPage })),
)
const TeamsPage = lazy(() =>
  import('@/features/teams/TeamPages').then((m) => ({ default: m.TeamsPage })),
)
const FromRequestPage = lazy(() =>
  import('@/features/workforce/Pages').then((m) => ({ default: m.FromRequestPage })),
)
const PeopleSearchPage = lazy(() =>
  import('@/features/workforce/Pages').then((m) => ({ default: m.PeopleSearchPage })),
)
const HelpPage = lazy(() =>
  import('@/features/workforce/MorePages').then((m) => ({ default: m.HelpPage })),
)
const MyProfilePage = lazy(() =>
  import('@/features/workforce/MorePages').then((m) => ({ default: m.MyProfilePage })),
)
const SavingsPage = lazy(() =>
  import('@/features/workforce/MorePages').then((m) => ({ default: m.SavingsPage })),
)
const SetupPage = lazy(() =>
  import('@/features/workforce/MorePages').then((m) => ({ default: m.SetupPage })),
)

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
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/new', element: <TeamBuilderPage /> },
      { path: 'teams/:teamId', element: <TeamPage /> },
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
