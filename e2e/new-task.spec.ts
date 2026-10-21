import { expect, test } from '@playwright/test'

for (const size of [
  { width: 1640, height: 900 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`new task fits the screen without scrolling at ${size.width}x${size.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(size)
    await page.goto('/tasks/new')
    await expect(page.getByRole('heading', { name: 'Upload the job description' })).toBeVisible()
    const overflow = await page.evaluate<number>(
      'document.documentElement.scrollHeight - window.innerHeight',
    )
    await page.screenshot({ path: info.outputPath('new-task.png') })
    expect(overflow).toBeLessThanOrEqual(0)
  })
}
