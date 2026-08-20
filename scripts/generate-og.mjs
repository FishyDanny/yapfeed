import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { chromium } from '@playwright/test';

const appRoot = resolve(import.meta.dirname, '..');
const source = await readFile(resolve(appRoot, 'scripts/og-source.html'), 'utf8');
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(source);
  await page.screenshot({ path: resolve(appRoot, 'public/og.png'), animations: 'disabled' });
} finally {
  await browser.close();
}

process.stdout.write('Generated public/og.png at 1200x630.\n');
