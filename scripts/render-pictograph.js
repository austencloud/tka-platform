#!/usr/bin/env node
/**
 * Render a single pictograph
 *
 * Usage: node scripts/render-pictograph.js A
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const letter = process.argv[2];

if (!letter) {
  console.log('Usage: node scripts/render-pictograph.js <letter>');
  console.log('Example: node scripts/render-pictograph.js A');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, '..', 'static', 'images', 'grant-feature');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Log console messages
  page.on('console', msg => console.log('[Browser]', msg.text()));
  page.on('pageerror', err => console.error('[Page Error]', err.message));

  try {
    await page.goto(`http://localhost:5173/render-pictograph.html?letter=${letter}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for canvas or error
    console.log('Waiting for render to complete...');
    await page.waitForTimeout(10000);

    // Take screenshot for debugging
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'debug-render.png') });
    console.log('Screenshot saved');

    const actualUrl = page.url();
    const pageTitle = await page.title();
    console.log('Actual URL:', actualUrl);
    console.log('Page title:', pageTitle);

    const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 200));
    console.log('Page content preview:', pageContent);

    // Get canvas data
    const dataUrl = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      console.log('Canvas found:', !!canvas);
      if (canvas) {
        console.log('Canvas size:', canvas.width, 'x', canvas.height);
      }
      return canvas ? canvas.toDataURL('image/png') : null;
    });

    if (!dataUrl) {
      throw new Error('No canvas found on page');
    }

    // Save to file
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const outputPath = path.join(OUTPUT_DIR, `pictograph-${letter}.png`);
    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ Rendered: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
