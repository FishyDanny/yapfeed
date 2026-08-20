import { expect, test } from '@playwright/test';

const deployedUrl = 'https://s72-yapfeed.pages.dev';

interface MediaSessionAudit {
  handlers: string[];
  metadata: { album?: string; artist?: string; title?: string } | null;
  playbackState: string;
}

test('a listener starts the live feed, advances eyes-free, and keeps a local like', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    const audit: MediaSessionAudit = { handlers: [], metadata: null, playbackState: 'none' };
    Object.defineProperty(window, '__mediaSessionAudit', { configurable: true, value: audit });
    Object.defineProperty(window, 'MediaMetadata', {
      configurable: true,
      value: class {
        album?: string;
        artist?: string;
        title?: string;

        constructor(init: MediaMetadataInit) {
          Object.assign(this, init);
        }
      },
    });
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: {
        get metadata() {
          return audit.metadata;
        },
        set metadata(value: MediaSessionAudit['metadata']) {
          audit.metadata = value;
        },
        get playbackState() {
          return audit.playbackState;
        },
        set playbackState(value: string) {
          audit.playbackState = value;
        },
        setActionHandler(action: string) {
          audit.handlers.push(action);
        },
      },
    });
  });

  const clipsResponse = await page.request.get(`${deployedUrl}/api/clips`);
  expect(clipsResponse.ok()).toBe(true);
  const payload = (await clipsResponse.json()) as {
    clips: Array<{ attribution: string; id: string; licence: string; source: string; sourceUrl: string }>;
  };
  expect(payload.clips.length).toBeGreaterThanOrEqual(50);
  expect(new Set(payload.clips.map((clip) => clip.id)).size).toBe(payload.clips.length);
  for (const clip of payload.clips) {
    expect(clip.attribution.trim()).not.toBe('');
    expect(clip.licence.trim()).not.toBe('');
    expect(clip.source).toMatch(/^https:\/\//);
    expect(clip.sourceUrl).toMatch(/^https:\/\/archive\.org\/download\//);
  }

  await page.goto(deployedUrl);
  await expect(page.getByText('58 short pieces ready')).toBeVisible();
  await expect(page.getByTestId('clip-title')).not.toHaveText('Loading a short piece…');
  await expect(page.locator('#clip-attribution')).not.toHaveText('');
  await expect(page.locator('#clip-licence')).not.toHaveText('');
  await expect(page.locator('#clip-source')).toHaveAttribute('href', /^https:\/\//);

  const firstTitle = await page.getByTestId('clip-title').innerText();
  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  const playRecorded = page.waitForResponse(
    (response) => response.url().endsWith('/api/plays') && response.request().method() === 'POST',
  );
  await page.locator('audio').evaluate((audio) => audio.dispatchEvent(new Event('ended')));
  await expect(page.getByTestId('clip-title')).not.toHaveText(firstTitle);
  expect.soft((await playRecorded).status()).toBe(201);

  const mediaSessionAudit = await page.evaluate(() =>
    (window as Window & { __mediaSessionAudit: MediaSessionAudit }).__mediaSessionAudit,
  );
  expect(mediaSessionAudit.handlers).toEqual(expect.arrayContaining(['play', 'pause', 'nexttrack', 'previoustrack']));
  expect(mediaSessionAudit.metadata?.title).toBe(await page.getByTestId('clip-title').innerText());
  expect(mediaSessionAudit.playbackState).toBe('playing');

  await page.getByRole('button', { name: 'Like this piece' }).click();
  await expect(page.getByRole('button', { name: 'Unlike this piece' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unlike this piece' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Submit a clip' }).click();
  await expect(page.getByText('A human reads every submission. Nothing publishes automatically.')).toBeVisible();
  await expect(page.getByLabel('Duration in seconds')).toHaveAttribute('max', '60');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const primaryAction = page.getByRole('button', { name: 'Start listening' });
  await expect(primaryAction).toBeVisible();
  const actionBox = await primaryAction.boundingBox();
  expect(actionBox).not.toBeNull();
  expect((actionBox?.y ?? 845) + (actionBox?.height ?? 0)).toBeLessThanOrEqual(844);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
