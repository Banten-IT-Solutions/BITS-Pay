import { test, expect, type Page } from '@playwright/test';

// Smoke test landing statis BITS Pay. Target: hasil `vite build` (dist/).
// Lihat playwright.config.ts untuk cara jalan & override E2E_BASE_URL.

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  // Toleransi 1px untuk rounding sub-pixel.
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('landing /', () => {
  for (const width of [390, 1280]) {
    test(`load bersih di viewport ${width}px: title, navbar pill, footer, tanpa horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveTitle(/BITS Pay/);
      await expect(page.locator('.navbar')).toBeVisible();
      // Pill navbar: container ber-border-radius penuh (999px).
      await expect(page.locator('.nav-container')).toHaveCSS('border-radius', '999px');
      await expect(page.locator('footer.footer')).toBeVisible();

      await expectNoHorizontalOverflow(page);
    });
  }

  test('klik Daftar → modal signup terbuka, lalu bisa ditutup', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('.nav-actions a[href="/signup"]').click();
    const modal = page.locator('#signup-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toHaveText('Daftar');

    await modal.locator('.modal-close').click();
    await expect(modal).toBeHidden();
  });

  test('theme toggle mengubah data-theme dan persist setelah reload', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(before === 'light' || before === 'dark').toBe(true);

    await page.locator('#theme-toggle').click();
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(after).not.toBe(before);
    expect(await page.evaluate(() => localStorage.getItem('bits-theme'))).toBe(after);

    await page.reload({ waitUntil: 'domcontentloaded' });
    const persisted = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(persisted).toBe(after);
  });
});

test.describe('halaman statis', () => {
  test('/terms.html: h1 Syarat & Ketentuan, footer center di mobile, link email ada', async ({
    page,
  }) => {
    await page.goto('/terms.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Syarat & Ketentuan');
    await expect(page.locator('a[href="mailto:admin@bits.co.id"]').first()).toBeVisible();

    // Mobile: footer-inner jadi kolom ter-center.
    await page.setViewportSize({ width: 390, height: 844 });
    const footerInner = page.locator('.footer-inner');
    await expect(footerInner).toHaveCSS('flex-direction', 'column');
    await expect(footerInner).toHaveCSS('align-items', 'center');
  });

  test('/docs/ Scalar API reference ter-render', async ({ page }) => {
    // Butuh internet: Scalar JS dari CDN jsdelivr + fetch /docs/openapi.json.
    await page.goto('/docs/', { waitUntil: 'networkidle' });
    await expect(page.locator('#scalar-app')).toContainText('BITS Pay API', { timeout: 20_000 });
  });
});
