import { test, expect } from '@playwright/test';

test.describe('Dhun Web Application - Full End-to-End Game Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Start with clean guest session
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Wait for the app to initialize
    await page.waitForSelector('div[role="region"][aria-label="Guess history"]', { timeout: 15000 });
  });

  test('loads home page, renders visualizer, controls, and daily challenge', async ({ page }) => {
    // 1. Verify Title & Brand
    await expect(page.locator('h1')).toContainText('DHUN');
    await expect(page.getByText('DAILY INDIAN MUSIC CHALLENGE')).toBeVisible();

    // 2. Verify Audio Controls Play/Loading button
    const audioBtn = page.locator('button[aria-label*="audio snippet"]');
    await expect(audioBtn).toBeVisible({ timeout: 10000 });

    // 3. Verify 6-segment Visualizer Bar
    const visualizer = page.locator('div[role="progressbar"]');
    await expect(visualizer).toBeVisible();

    // 4. Verify 6 attempt rows in guess history
    const attemptRows = page.locator('div[aria-label^="Attempt"]');
    await expect(attemptRows).toHaveCount(6);
  });

  test('advances clip duration on Skip and records attempt in history', async ({ page }) => {
    // Wait for skip button to be ready
    const skipButton = page.locator('button:has-text("Skip")');
    await expect(skipButton).toBeVisible({ timeout: 10000 });

    // Click Skip (+0.4s)
    await skipButton.click();

    // Verify first attempt shows SKIPPED
    await expect(page.locator('div[aria-label="Attempt 1: Skipped"]')).toBeVisible({ timeout: 10000 });

    // Audio controls should now indicate next clip duration (+1.5s)
    await expect(page.locator('button:has-text("Skip")')).toContainText('+1.5s');
  });

  test('toggles Practice Mode, exposes regional filters, and loads fresh session', async ({ page }) => {
    // Click Practice Mode tab
    const practiceTab = page.locator('button:has-text("Practice Mode")');
    await expect(practiceTab).toBeVisible();
    await practiceTab.click();

    // Filter selectors should appear
    await expect(page.locator('#filter-language')).toBeVisible();
    await expect(page.locator('#filter-era')).toBeVisible();
    await expect(page.locator('#filter-genre')).toBeVisible();

    // Select language filter
    await page.locator('#filter-language').selectOption('hindi');
    await page.locator('#filter-era').selectOption('2010s');

    // Click "New Song"
    const newSongButton = page.locator('button:has-text("New Song")');
    await newSongButton.click();

    // Verify attempts reset to 6 slots and initial +0.5s
    const attemptRows = page.locator('div[aria-label^="Attempt"]');
    await expect(attemptRows).toHaveCount(6);
    await expect(page.locator('button:has-text("Skip")')).toContainText('+0.5s');
  });

  test('searches autocomplete, selects song, and verifies victory flow', async ({ page }) => {
    // Type in autocomplete input
    const searchInput = page.locator('input[role="combobox"]');
    await searchInput.scrollIntoViewIfNeeded();
    await searchInput.click();
    await searchInput.fill('Dil Ke Saaz');

    // Dropdown listbox should appear with options
    const listbox = page.locator('ul[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5000 });

    const option = page.locator('li[role="option"]:has-text("Dil Ke Saaz")').first();
    await expect(option).toBeVisible();
    await option.click();

    // Victory modal should open and display winning solution
    await expect(page.getByText('Wah! You got it!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('div[role="dialog"]')).toContainText('Dil Ke Saaz');
  });
});
