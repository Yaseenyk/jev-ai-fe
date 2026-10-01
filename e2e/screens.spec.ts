import { expect, test } from '@playwright/test'

// Visual review aid: full-page screenshots of the main screens (written to e2e-shots/).
test('capture main screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/tasks')
  await expect(page.getByRole('heading', { name: 'Open tasks' })).toBeVisible()
  await page.screenshot({ path: 'e2e-shots/1-tasks.png', fullPage: true })

  await page.getByRole('link', { name: /Snowflake Data Engineer/ }).click()
  await expect(page.getByRole('button', { name: /run matching/i })).toBeVisible()
  await page.screenshot({ path: 'e2e-shots/2-task.png', fullPage: true })

  await page
    .getByRole('link', { name: /people ranked/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: /^Shortlist/ })).toBeVisible()
  await page.screenshot({ path: 'e2e-shots/3-run.png', fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'e2e-shots/4-run-mobile.png', fullPage: false })
})
