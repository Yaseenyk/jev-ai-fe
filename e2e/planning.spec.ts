import { expect, test } from '@playwright/test'

test('manager plans: bench, skill gaps, a team for two tasks, then hire or move on a task', async ({
  page,
}) => {
  await page.goto('/tasks')
  await page.getByRole('link', { name: 'Planning' }).first().click()
  await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible()
  await expect(page.getByText('Idle cost per week')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Bench' }).getByRole('row').nth(1)).toBeVisible()

  await page.getByRole('table', { name: 'Bench' }).getByRole('link').first().click()
  await expect(page.getByText('Revenue billed (estimate)')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Best next tasks' })).toBeVisible()
  await page.getByRole('link', { name: 'Bench' }).click()

  await page.getByRole('tab', { name: 'Rolling off' }).click()
  await expect(page.getByText('Weekly cost at risk')).toBeVisible()
  await page.getByRole('tab', { name: 'What-if' }).click()
  await expect(page.getByRole('button', { name: /Can we staff it/ })).toBeVisible()

  await page.getByRole('tab', { name: 'Skill gaps' }).click()
  await page.getByRole('button', { name: /All skills/ }).click()
  await expect(
    page.getByRole('table', { name: 'Skill gaps' }).getByRole('row').nth(1),
  ).toBeVisible()

  await page.getByRole('tab', { name: 'Project staffing' }).click()
  const list = page.getByRole('region', { name: 'Tasks to staff' })
  await list.getByRole('checkbox', { name: /Snowflake Data Engineer/ }).check()
  await page.getByRole('button', { name: /Propose a team \(1\)/ }).click()
  const team = page.getByRole('region', { name: 'Proposed team' })
  await expect(team.getByText('Tasks filled')).toBeVisible()
  await team.getByRole('link', { name: /Snowflake Data Engineer/ }).click()

  const card = page.getByRole('region', { name: 'Hire or move internally' })
  await expect(card.getByText('Move someone inside')).toBeVisible()
})
