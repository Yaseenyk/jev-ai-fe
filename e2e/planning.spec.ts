import { expect, test, type Page } from '@playwright/test'

/** From any planning tool: back to the questions, then open another one. */
async function openTool(page: Page, question: RegExp) {
  await page.getByRole('link', { name: 'All planning tools' }).click()
  await page.getByRole('link', { name: question }).click()
}

test('manager plans: bench, skill gaps, a team for a task, then hire or move on the task', async ({
  page,
}) => {
  await page.goto('/tasks')
  await page.getByRole('link', { name: 'Planning' }).first().click()
  await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible()
  await page.getByRole('link', { name: /Who is free now or soon\?/ }).click()
  await expect(page.getByRole('region', { name: 'How to use' })).toBeVisible()
  // Billing is hidden by default (ADR 034): no money on the planning screens.
  await expect(page.getByText('Free now').first()).toBeVisible()
  await expect(page.getByText('Idle cost per week')).toHaveCount(0)
  const bench = page.getByRole('table', { name: 'Bench' })
  await expect(bench.getByRole('row').nth(1)).toBeVisible()
  await bench.getByRole('button', { name: 'Best task match' }).click()
  await expect(bench.getByRole('columnheader', { name: 'Best task match' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )

  await bench.getByRole('row').nth(1).locator('td').first().click()
  await expect(page.getByText('Weeks on client work')).toBeVisible()
  await expect(page.getByText('Revenue billed (estimate)')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Best next tasks' })).toBeVisible()
  await page.getByRole('link', { name: 'Who is free' }).click()

  await openTool(page, /Whose current work ends soon\?/)
  await expect(page.getByText('Weekly cost at risk')).toHaveCount(0)
  await openTool(page, /Could we staff a project we might win\?/)
  await expect(page.getByRole('button', { name: /Can we staff it/ })).toBeVisible()

  await openTool(page, /Which skills are we short of\?/)
  await page.getByRole('button', { name: /All skills/ }).click()
  await expect(
    page.getByRole('table', { name: 'Skill gaps' }).getByRole('row').nth(1),
  ).toBeVisible()

  // Staffing a task is one flow: lead, members, optional shadow, then the team's own page.
  await page.getByRole('link', { name: 'All planning tools' }).click()
  await page.getByRole('link', { name: /Who should be on the team for a task\?/ }).click()
  await page.getByRole('combobox', { name: 'Task' }).click()
  await page.getByRole('option', { name: /Snowflake Data Engineer/ }).click()
  await page
    .getByRole('list', { name: 'Team Lead options' })
    .getByRole('button', { name: 'Choose as lead' })
    .first()
    .click()
  await page.getByRole('button', { name: 'No shadow' }).click()
  await page.getByRole('button', { name: 'Create team' }).click()
  await expect(page.getByRole('heading', { name: /Team for TSK-/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Team Lead' })).toContainText('Leads the team')
  await page.getByRole('link', { name: /Open task to accept people/ }).click()

  const card = page.getByRole('region', { name: 'Hire or move internally' })
  await expect(card.getByText('Move someone inside')).toBeVisible()
})
