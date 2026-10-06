import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

// TSK-0019: nobody internal fits and HR has no request for it yet (demo data).
const demo = JSON.parse(readFileSync('src/mocks/data/demo.json', 'utf8')) as {
  tasks: { id: string; code: string }[]
  runs: Record<string, { run: { id: string } } | undefined>
}
const task = demo.tasks.find((t) => t.code === 'TSK-0019')
const runId = task && demo.runs[task.id]?.run.id
if (!task || !runId) throw new Error('demo data is missing TSK-0019 or its run')

// Mock data lives in the page, so the flow never reloads: signing out returns to the same page.
async function signInAs(page: Page, email: string) {
  await page.getByRole('button', { name: 'Sign out' }).first().click()
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('demo-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

test('no internal fit → HR finds candidates → manager decides → HR contacts', async ({ page }) => {
  // Manager: nobody internal fits, so they ask HR for three candidates.
  await page.goto(`/runs/${runId}`)
  const noFit = page.getByRole('region', { name: 'No internal fit' })
  await noFit.getByRole('button', { name: /Ask HR for candidates/ }).click()
  await page.getByLabel(/How many candidates/).fill('3')
  await page.getByLabel('Anything HR should know').fill('Client needs someone in a month')
  await page.getByRole('button', { name: 'Send to HR' }).click()
  const openRequest = noFit.getByRole('link', { name: 'Open the request' })
  await expect(openRequest).toBeVisible()
  const requestPath = (await openRequest.getAttribute('href')) ?? ''

  // HR: notified, opens the request, sends two candidates from the ranked pool.
  await signInAs(page, 'hr@srtm.local')
  await page.getByRole('button', { name: /Notifications, \d+ unread/ }).click()
  await page.getByText(`New request for ${task.code}`).click()
  await expect(page).toHaveURL(requestPath)
  await expect(page.getByText('“Client needs someone in a month”')).toBeVisible()
  await page.getByRole('button', { name: 'Start searching' }).click()
  const picks = page.getByRole('checkbox', { name: /^Pick / })
  await picks.nth(0).check()
  await picks.nth(1).check()
  const fitName = ((await picks.nth(0).getAttribute('aria-label')) ?? '').replace(/^Pick /, '')
  await page.getByRole('button', { name: /Send 2 to the manager/ }).click()
  await expect(page.getByText(/Sent to the manager \(2 of 10\)/)).toBeVisible()

  // Manager: sees first names only; marks the first fit and the second not.
  await signInAs(page, 'manager1@srtm.local')
  await expect(page).toHaveURL(requestPath)
  const cards = page.getByRole('list', { name: 'Candidates sent by HR' }).locator('> li')
  await expect(cards).toHaveCount(2)
  await expect(page.getByText(fitName)).toHaveCount(0)
  await cards.nth(0).getByRole('button', { name: /^Fit/ }).click()
  await cards
    .nth(1)
    .getByRole('button', { name: /Not a fit/ })
    .click()
  await expect(page.getByText(/All decided/)).toBeVisible()

  // HR: sees who was marked fit and moves them to Contacted.
  await signInAs(page, 'hr@srtm.local')
  await expect(page).toHaveURL(requestPath)
  await page
    .getByRole('region', { name: 'Marked fit' })
    .getByRole('link', { name: 'Open to contact' })
    .click()
  await expect(page.getByRole('heading', { name: fitName })).toBeVisible()
  await page
    .getByRole('list', { name: 'Status' })
    .getByRole('button', { name: 'Contacted' })
    .click()
  await page.getByRole('button', { name: 'Move to Contacted' }).click()
  await expect(
    page.getByRole('list', { name: 'Status' }).getByRole('button', { name: 'Contacted' }),
  ).toBeDisabled()
})
