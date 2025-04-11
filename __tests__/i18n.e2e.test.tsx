import { test, expect } from '@playwright/test';

test.describe('Internationalization Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should switch languages and persist selection', async ({ page }) => {
    // Open language selector
    const languageSelector = await page.getByRole('button', { name: /select language/i });
    await languageSelector.click();

    // Select French
    const frenchOption = await page.getByText('Français');
    await frenchOption.click();

    // Verify content is in French
    await expect(page.getByText('Paramètres de Format')).toBeVisible();

    // Reload page and verify language persists
    await page.reload();
    await expect(page.getByText('Paramètres de Format')).toBeVisible();
  });

  test('should handle RTL languages correctly', async ({ page }) => {
    // Select Arabic
    const languageSelector = await page.getByRole('button', { name: /select language/i });
    await languageSelector.click();
    const arabicOption = await page.getByText('العربية');
    await arabicOption.click();

    // Verify RTL direction
    const body = await page.locator('body');
    await expect(body).toHaveAttribute('dir', 'rtl');

    // Verify text alignment
    const content = await page.locator('.rtl-content');
    const textAlign = await content.evaluate((el) => {
      return window.getComputedStyle(el).textAlign;
    });
    expect(textAlign).toBe('right');
  });

  test('should format numbers according to locale', async ({ page }) => {
    // Test number formatting in different locales
    const locales = [
      { lang: 'en', expected: '1,234.56' },
      { lang: 'fr', expected: '1 234,56' },
      { lang: 'de', expected: '1.234,56' },
      { lang: 'ar', expected: '١٬٢٣٤٫٥٦' }
    ];

    for (const { lang, expected } of locales) {
      // Select language
      const languageSelector = await page.getByRole('button', { name: /select language/i });
      await languageSelector.click();
      const option = await page.getByText(new RegExp(lang, 'i'));
      await option.click();

      // Check number formatting
      const number = await page.locator('[data-testid="formatted-number"]');
      await expect(number).toHaveText(expected);
    }
  });

  test('should format dates according to locale', async ({ page }) => {
    // Test date formatting in different locales
    const locales = [
      { lang: 'en', expected: /January 1, 2024/ },
      { lang: 'fr', expected: /1 janvier 2024/ },
      { lang: 'de', expected: /1. Januar 2024/ },
      { lang: 'es', expected: /1 de enero de 2024/ }
    ];

    for (const { lang, expected } of locales) {
      // Select language
      const languageSelector = await page.getByRole('button', { name: /select language/i });
      await languageSelector.click();
      const option = await page.getByText(new RegExp(lang, 'i'));
      await option.click();

      // Check date formatting
      const date = await page.locator('[data-testid="formatted-date"]');
      await expect(date).toHaveText(expected);
    }
  });

  test('should format currency according to locale', async ({ page }) => {
    // Test currency formatting in different locales
    const locales = [
      { lang: 'en', expected: '$1,234.56' },
      { lang: 'fr', expected: '1 234,56 €' },
      { lang: 'de', expected: '1.234,56 €' },
      { lang: 'jp', expected: '¥1,235' }
    ];

    for (const { lang, expected } of locales) {
      // Select language
      const languageSelector = await page.getByRole('button', { name: /select language/i });
      await languageSelector.click();
      const option = await page.getByText(new RegExp(lang, 'i'));
      await option.click();

      // Check currency formatting
      const currency = await page.locator('[data-testid="formatted-currency"]');
      await expect(currency).toHaveText(expected);
    }
  });

  test('should handle keyboard navigation in language selector', async ({ page }) => {
    // Focus language selector
    const languageSelector = await page.getByRole('button', { name: /select language/i });
    await languageSelector.focus();

    // Open menu with Enter
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();

    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Select with Enter
    await page.keyboard.press('Enter');

    // Verify menu is closed
    await expect(page.getByRole('listbox')).not.toBeVisible();
  });

  test('should announce language changes to screen readers', async ({ page }) => {
    // Enable screen reader announcements
    await page.evaluate(() => {
      window.announce = (message) => {
        const div = document.createElement('div');
        div.setAttribute('role', 'alert');
        div.textContent = message;
        document.body.appendChild(div);
      };
    });

    // Change language
    const languageSelector = await page.getByRole('button', { name: /select language/i });
    await languageSelector.click();
    const frenchOption = await page.getByText('Français');
    await frenchOption.click();

    // Verify announcement
    await expect(page.getByRole('alert')).toHaveText(/Language changed to French/);
  });

  test('should load translations efficiently', async ({ page }) => {
    // Enable performance monitoring
    await page.evaluate(() => {
      window.performance.mark('start-loading');
    });

    // Change to a lazy-loaded language
    const languageSelector = await page.getByRole('button', { name: /select language/i });
    await languageSelector.click();
    const arabicOption = await page.getByText('العربية');
    await arabicOption.click();

    // Measure loading time
    const loadingTime = await page.evaluate(() => {
      window.performance.mark('end-loading');
      const measure = window.performance.measure('loading-time', 'start-loading', 'end-loading');
      return measure.duration;
    });

    // Verify loading time is reasonable
    expect(loadingTime).toBeLessThan(1000); // Should load within 1 second
  });
}); 