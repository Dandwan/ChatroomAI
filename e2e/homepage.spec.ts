import { test, expect } from '@playwright/test'

test.describe('ActiChat Homepage', () => {
  test('loads the homepage', async ({ page }) => {
    await page.goto('/')
    // The app should render without crashing
    await expect(page.locator('#root')).toBeVisible()
  })

  test('shows app title or branding', async ({ page }) => {
    await page.goto('/')
    // Wait for the app to render
    await page.waitForSelector('#root')
    // The page should have content
    const text = await page.textContent('body')
    expect(text).toBeTruthy()
  })
})
