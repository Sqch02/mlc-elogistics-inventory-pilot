import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
  })

  test('should display login form elements', async ({ page }) => {
    // Wait for the form to be visible first
    await expect(page.locator('form')).toBeVisible({ timeout: 15000 })

    // Check page title - use text content search
    await expect(page.getByText('HME Logistics')).toBeVisible()

    // Check form description
    await expect(page.getByText('Connectez-vous')).toBeVisible()

    // Check email input by id
    await expect(page.locator('#email')).toBeVisible()

    // Check password input by id
    await expect(page.locator('#password')).toBeVisible()

    // Check submit button
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  })

  test('should have required fields', async ({ page }) => {
    await expect(page.locator('form')).toBeVisible({ timeout: 15000 })

    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')

    // Check required attribute
    await expect(emailInput).toHaveAttribute('required', '')
    await expect(passwordInput).toHaveAttribute('required', '')
  })

  test('should show loading state on submit', async ({ page }) => {
    await expect(page.locator('form')).toBeVisible({ timeout: 15000 })

    // Fill the form
    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('password123')

    // Click submit
    await page.getByRole('button', { name: 'Se connecter' }).click()

    // Button should show loading text (briefly)
    await expect(page.getByRole('button', { name: 'Connexion...' })).toBeVisible({ timeout: 5000 })
  })

  test('should validate email format', async ({ page }) => {
    await expect(page.locator('form')).toBeVisible({ timeout: 15000 })

    const emailInput = page.locator('#email')

    // Input should have email type for browser validation
    await expect(emailInput).toHaveAttribute('type', 'email')
  })

  test('should show error on invalid credentials', async ({ page }) => {
    await expect(page.locator('form')).toBeVisible({ timeout: 15000 })

    // Fill with invalid credentials
    await page.locator('#email').fill('invalid@test.com')
    await page.locator('#password').fill('wrongpassword')

    // Submit
    await page.getByRole('button', { name: 'Se connecter' }).click()

    // Wait for error message (Supabase returns "Invalid login credentials")
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 })
  })
})
