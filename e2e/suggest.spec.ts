import { readFileSync } from 'node:fs'

import { type Page, expect, test } from '@playwright/test'

// HR checks an outside resume from a task, suggests the person; the task's manager decides.
const demo = JSON.parse(readFileSync('src/mocks/data/demo.json', 'utf8')) as {
  tasks: { id: string; code: string }[]
}
const task = demo.tasks.find((t) => t.code === 'TSK-0019')
if (!task) throw new Error('demo data is missing TSK-0019')

async function signInAs(page: Page, email: string) {
  await page.getByRole('button', { name: 'Sign out' }).first().click()
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('demo-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

test('HR checks a resume for a task and suggests the person; the manager decides', async ({
  page,
}) => {
  await page.goto('/tasks')
  await signInAs(page, 'hr@srtm.local')
  await page.goto(`/tasks/${task.id}`)
  await page
    .getByRole('link', { name: /Check a resume for this task/ })
    .first()
    .click()

  await page.getByLabel('Resume file').setInputFiles({
    name: 'cv-0.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('resume'),
  })
  await page.getByRole('button', { name: /Read the resume/ }).click()
  const name = page.getByLabel(/^Full name/)
  await name.fill('Priya Demo')
  await page.getByRole('checkbox', { name: /candidate agreed/ }).check()
  await page.getByRole('button', { name: 'Save candidate' }).click()

  const card = page.getByRole('listitem', { name: 'Priya Demo' })
  await expect(card.getByText('Just checked')).toBeVisible()
  await card.getByRole('button', { name: /Suggest to the manager/ }).click()
  await page.getByLabel(/Note for the manager/).fill('Strong fit, can join in 2 weeks')
  await page.getByRole('button', { name: /Send to the manager/ }).click()
  await expect(card.getByText('Sent to the manager')).toBeVisible()

  // Mock data lives in the page: move around without reloading it.
  await signInAs(page, 'manager1@srtm.local')
  await page.getByRole('link', { name: 'Tasks' }).first().click()
  await page.getByLabel('Search tasks').fill(task.code)
  await page.getByRole('row', { name: new RegExp(task.code) }).click()
  const fromHr = page.getByRole('region', { name: 'Candidates from HR' })
  await fromHr.getByRole('button', { name: /Priya/ }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Strong fit, can join in 2 weeks')).toBeVisible()
  await sheet.getByRole('button', { name: /Fit, HR can contact them/ }).click()
  await expect(sheet.getByText('You said: fit')).toBeVisible()
})
