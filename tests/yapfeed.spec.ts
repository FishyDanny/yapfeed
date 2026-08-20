import { expect, test } from '@playwright/test';

interface RecordedRequest {
  method: string;
  url: string;
  body: unknown;
}

const clips = Array.from({ length: 58 }, (_, index) => ({
  id: `lv-collection-story-${index.toString().padStart(2, '0')}`,
  title: `Story ${index + 1}`,
  sourceUrl: `https://archive.org/download/collection/story-${index}.mp3`,
  durationS: 120 + index,
  licence: 'Public Domain Mark 1.0',
  attribution: `By Writer ${index + 1}. LibriVox volunteer recording.`,
  source: 'https://archive.org/details/collection',
}));
const usesLiveApi = process.env.PLAYWRIGHT_BASE_URL !== undefined;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ mockAudio }) => {
    if (mockAudio) {
      Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value() {
          this.dispatchEvent(new Event('play'));
          return Promise.resolve();
        },
      });
      Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
        configurable: true,
        value() {
          this.dispatchEvent(new Event('pause'));
        },
      });
    }
    Object.defineProperty(window, 'MediaMetadata', {
      configurable: true,
      value: class {
        constructor(init: MediaMetadataInit) {
          Object.assign(this, init);
        }
      },
    });
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: {
        metadata: null,
        playbackState: 'none',
        setActionHandler() {},
      },
    });
  }, { mockAudio: !usesLiveApi });
});

test('starts once, advances without another look and keeps a local like', async ({ page }) => {
  const requests: RecordedRequest[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET' && request.url().endsWith('/api/clips')) {
      if (usesLiveApi) {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clips }) });
      return;
    }
    requests.push({ method: request.method(), url: request.url(), body: request.postDataJSON() });
    if (usesLiveApi) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ recorded: true }) });
  });

  await page.goto('/');
  await expect(page.getByText('58 short pieces ready')).toBeVisible();
  const title = page.getByTestId('clip-title');
  const firstTitle = await title.textContent();

  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  const playResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/plays') && response.request().method() === 'POST',
  );
  await page.locator('audio').evaluate((audio) => audio.dispatchEvent(new Event('ended')));
  await expect(title).not.toHaveText(firstTitle ?? '');
  expect((await playResponse).status()).toBe(201);

  const skippedClipId = await page.evaluate(() => localStorage.getItem('yapfeed.current.clip'));
  await page.getByRole('button', { name: 'Next piece' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yapfeed.skips') ?? '[]'))).toContain(
    skippedClipId,
  );

  const likeButton = page.getByRole('button', { name: 'Like this piece' });
  await likeButton.click();
  await expect(likeButton).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unlike this piece' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yapfeed.skips') ?? '[]'))).toContain(
    skippedClipId,
  );
  expect(requests.some((request) => request.url.endsWith('/api/plays'))).toBe(true);
});

test('keeps a chosen listening speed across a reload', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    if (usesLiveApi) {
      await route.continue();
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clips }) });
      return;
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ recorded: true }) });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start listening' })).toBeEnabled();

  const faster = page.getByRole('button', { name: '1.5x' });
  await faster.click();
  await expect(faster).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Playing at 1.5x')).toBeVisible();
  expect(await page.locator('audio').evaluate((audio) => audio.playbackRate)).toBe(1.5);

  await page.reload();
  await expect(page.getByRole('button', { name: '1.5x' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('audio').evaluate((audio) => audio.playbackRate)).toBe(1.5);
});

test('queues a one-minute contribution for human review', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      if (usesLiveApi) {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clips }) });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'submission-1', status: 'pending' }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Submit a clip' }).click();
  await page.getByLabel('Your email').fill('listener@example.com');
  await page.getByLabel('HTTPS audio URL').fill('https://audio.example.com/thought.mp3');
  await page.getByLabel('Duration in seconds').fill('60');
  await page.getByLabel('Note for the reviewer').fill('A one-minute field note.');
  await page.getByRole('button', { name: 'Send for review' }).click();

  await expect(page.getByText('Queued for a human to review')).toBeVisible();
  await expect(page.getByText('It will not appear in the feed unless it is approved.')).toBeVisible();
});
