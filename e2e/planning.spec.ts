import { expect, test, type Page } from '@playwright/test'

/** From any planning tool: back to the questions, then open another one. */
async function openTool(page: Page, question: RegExp) {
  await page.getByRole('link', { name: 'All planning tools' }).click()
  await page.getByRole('link', { name: question }).click()
}

test('manager plans: bench, skill gaps, a team for two tasks, then hire or move on a task', async ({
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

  await openTool(page, /Who should make up the team for a client's work\?/)
  await page.getByRole('combobox', { name: 'Client' }).click()
  await page.getByRole('option', { name: /CL-ZENITH/ }).click()
  await page.getByRole('button', { name: 'Propose a team for CL-ZENITH' }).click()
  const team = page.getByRole('region', { name: 'Proposed team' })
  await expect(
    team.getByRole('heading', { name: /Team for CL-ZENITH: \d+ of \d+ people found/ }),
  ).toBeVisible()
  await team.getByRole('link', { name: /Snowflake Data Engineer/ }).click()

  const card = page.getByRole('region', { name: 'Hire or move internally' })
  await expect(card.getByText('Move someone inside')).toBeVisible()
})
