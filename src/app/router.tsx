import { Link, Navigate, createBrowserRouter } from 'react-router'

import { Layout } from '@/app/Layout'
import { EmptyState } from '@/components/QueryStates'
import RunPage from '@/features/runs/RunPage'
import TaskDetailPage from '@/features/tasks/TaskDetailPage'
import TaskListPage from '@/features/tasks/TaskListPage'

export const routes = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/tasks" replace /> },
      { path: 'tasks', element: <TaskListPage /> },
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
