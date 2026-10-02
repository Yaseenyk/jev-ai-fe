import { Link, Navigate, createBrowserRouter } from 'react-router'

import { Layout } from '@/app/Layout'
import { EmptyState } from '@/components/QueryStates'
import { RequireAuth } from '@/features/auth/AuthProvider'
import LoginPage from '@/features/auth/LoginPage'
import NewTaskChatPage from '@/features/newTask/NewTaskChatPage'
import RunPage from '@/features/runs/RunPage'
import TaskDetailPage from '@/features/tasks/TaskDetailPage'
import TaskListPage from '@/features/tasks/TaskListPage'

export const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/tasks" replace /> },
      { path: 'tasks', element: <TaskListPage /> },
      { path: 'tasks/new', element: <NewTaskChatPage /> },
      { path: 'tasks/:taskId', element: <TaskDetailPage /> },
      { path: 'runs/:runId', element: <RunPage /> },
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
