import { test, expect } from '@playwright/test';

test.describe('Knowledge Point Management', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/knowledge-points');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Question List', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/questions');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Exam Generation', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/exams');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Wrong Question Book', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/wrong-questions');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Mastery Report', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/mastery');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Knowledge Map', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/knowledge-map');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Mock Exam', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/mock-exams');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Learning Incentive', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/incentive');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Recommendation', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/recommendation');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Learning Path', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/learning-path');
    await expect(page).toHaveURL(/\/login/);
  });
});
