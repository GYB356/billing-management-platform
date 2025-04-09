import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test('complete subscription purchase flow', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="subscribe-button"]');
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="card-expiry"]', '12/25');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.click('[data-testid="submit-payment"]');
    
    expect(await page.textContent('[data-testid="success-message"]'))
      .toContain('Payment successful');
  });
});
