import { expect, test } from '@playwright/test'

test('manager runs matching, sees the shortlist, and rejects with a reason', async ({ page }) => {
  await page.goto('/tasks')
  await page.getByRole('link', { name: /Snowflake Data Engineer/ }).click()
  await page.getByRole('button', { name: /run matching/i }).click()

  await expect(page.getByText(/Matching in progress|Waiting to start/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Shortlist/ })).toBeVisible({ timeout: 15_000 })

  const card = page.locator('[data-slot="card"]').first()
  await expect(card.getByText('Facts from the data')).toBeVisible()
  await card.getByRole('button', { name: /^reject$/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').click()
  await page.getByRole('option', { name: 'Skill gap' }).click()
  await dialog.getByRole('button', { name: /^reject$/i }).click()
  await expect(card.getByText(/Rejected · Skill gap/)).toBeVisible()
})
