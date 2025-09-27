import { test, expect } from '@playwright/test';
import { resetSupabaseData } from './fixtures/supabaseSeeder';

const STATUS_CARDS = ['Submitted', 'Invalidated', 'Live', 'Determined'];

test.describe.serial('Supabase-integrated flows', () => {
  test.beforeAll(async () => {
    await resetSupabaseData();
  });

  test('dashboard surfaces spreadsheet-backed metrics', async ({ page }) => {
    const statusCounts: Record<string, number> = {};
    for (const status of STATUS_CARDS) {
      const response = await page.request.get(`/api/applications?status=${encodeURIComponent(status)}`);
      const data = await response.json();
      statusCounts[status] = data.items.length;
    }

    const issuesResponse = await page.request.get('/api/issues');
    const issuesData = await issuesResponse.json();
    const issues = issuesData.items ?? [];

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    for (const status of STATUS_CARDS) {
      const card = page.locator('section[aria-label="Status summary"]').getByRole('link', { name: new RegExp(status) });
      await expect(card).toBeVisible();
      const badge = card.locator('span').first();
      await expect(badge).toHaveText(String(statusCounts[status]));
    }

    const issuesCard = page.locator('section[aria-label="Status summary"]').getByRole('link', { name: /Issues/ });
    await expect(issuesCard.locator('span').first()).toHaveText(String(issues.length));

    const latestIssuesSection = page.locator('section[aria-label="Recent issues"]');
    if (issues.length === 0) {
      await expect(latestIssuesSection).toContainText('No issues recorded yet.');
    } else {
      await expect(latestIssuesSection.locator('li').first()).toContainText(issues[0].title);
    }
  });

  test('applications board lists spreadsheet-derived records per status', async ({ page }) => {
    const statusData: Record<string, { length: number; title?: string }> = {};
    for (const status of STATUS_CARDS) {
      const response = await page.request.get(`/api/applications?status=${encodeURIComponent(status)}`);
      const data = await response.json();
      statusData[status] = { length: data.items.length, title: data.items[0]?.prjCodeName };
    }

    await page.goto('/applications');

    for (const status of STATUS_CARDS) {
      const column = page.getByTestId(`status-column-${status.toLowerCase()}`);
      await expect(column).toBeVisible();
      await expect(column.locator('header span').last()).toHaveText(String(statusData[status].length));

      const cards = column.getByRole('button');
      if (statusData[status].length > 0 && statusData[status].title) {
        await expect(cards).toHaveCount(statusData[status].length);
        await expect(cards.first()).toContainText(statusData[status].title ?? '');
      } else {
        await expect(cards).toHaveCount(0);
        await expect(column).toContainText('No records');
      }
    }
  });

  test('issues table renders spreadsheet-backed data and filtering works when available', async ({ page }) => {
    const issuesResponse = await page.request.get('/api/issues');
    const issuesData = await issuesResponse.json();
    const issues = issuesData.items ?? [];

    await page.goto('/issues');

    if (issues.length === 0) {
      const emptyMessage = page.getByText('No issues recorded.');
      await expect(emptyMessage).toBeVisible();
      await page
        .locator('nav[aria-label="Issue status filter"]')
        .getByRole('button', { name: 'Open', exact: true })
        .click();
      await expect(emptyMessage).toBeVisible();
      return;
    }

    const table = page.locator('table.status-table');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(issues.length);
    await expect(table.locator('tbody tr').first()).toContainText(issues[0].title);

    const openIssues = issues.filter((issue: { status: string }) => issue.status === 'Open');
    await page
      .locator('nav[aria-label="Issue status filter"]')
      .getByRole('button', { name: 'Open', exact: true })
      .click();

    if (openIssues.length === 0) {
      await expect(page.getByText('No issues recorded.')).toBeVisible();
    } else {
      await expect(table.locator('tbody tr')).toHaveCount(openIssues.length);
      await expect(table.locator('tbody tr').first()).toContainText(openIssues[0].title);
    }
  });

  test('applications board shows useful error feedback when the API is unavailable', async ({ page }) => {
    await page.route('**/api/applications?status=*', (route) => route.abort());
    await page.goto('/applications');

    await expect(page.locator('text=Failed to load').first()).toBeVisible();
  });
});
