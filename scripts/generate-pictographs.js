#!/usr/bin/env node
/**
 * Generate Pictograph Images
 *
 * Uses the real Canvas2DDirectRenderer via Playwright to generate pictographs.
 * Fully autonomous - just run and it saves files to the correct location.
 *
 * Usage:
 *   node scripts/generate-pictographs.js A B C
 *   node scripts/generate-pictographs.js --all
 *
 * Prerequisites:
 *   - Dev server running on localhost:5173
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, '..', 'static', 'images', 'grant-feature');

async function generatePictographs(letters) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TKA Pictograph Generator (Real Renderer)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n📝 Generating ${letters.length} pictograph(s): ${letters.join(', ')}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('Lit is in dev mode')) {
      console.log(`  [Browser] ${text}`);
    }
  });

  // Collect page errors
  page.on('pageerror', error => {
    console.error(`  [Page Error] ${error.message}`);
  });

  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Navigate to the grant-feature page (which exposes the render function)
    console.log('🌐 Loading grant-feature page...');
    await page.goto(`${BASE_URL}/grant-feature`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the page to expose the render function
    console.log('⏳ Waiting for renderer to initialize...');

    // Poll for the function to be available (up to 30 seconds)
    let functionAvailable = false;
    for (let i = 0; i < 60; i++) {
      const available = await page.evaluate(() => typeof window.renderPictograph === 'function');
      if (available) {
        functionAvailable = true;
        break;
      }
      await page.waitForTimeout(500);
    }

    if (!functionAvailable) {
      // Check what the page status is and take screenshot
      const pageStatus = await page.evaluate(() => {
        const statusDiv = document.querySelector('.status');
        return statusDiv ? statusDiv.textContent : 'Status element not found';
      });
      const pageUrl = page.url();
      const pageTitle = await page.title();
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'debug-screenshot.png') });
      throw new Error(`Renderer failed to initialize after 30 seconds.\nURL: ${pageUrl}\nTitle: ${pageTitle}\nPage status: ${pageStatus}\nScreenshot saved to: ${path.join(OUTPUT_DIR, 'debug-screenshot.png')}`);
    }

    console.log('✓ Renderer ready');

    for (const letter of letters) {
      console.log(`\n🎨 Rendering pictograph: ${letter}`);

      // Call the render function exposed on the page
      const imageData = await page.evaluate(async (letter) => {
        // Function will be available globally via the render-pictographs page
        if (typeof window.renderPictograph !== 'function') {
          throw new Error('Render function not found. Make sure render-pictographs page is loaded.');
        }
        return await window.renderPictograph(letter);
      }, letter);

      console.log(`  ✓ Rendered with real Canvas2DDirectRenderer`);

      // Save to file
      const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const outputPath = path.join(OUTPUT_DIR, `pictograph-${letter}.png`);
      fs.writeFileSync(outputPath, buffer);

      console.log(`  ✓ Saved: ${outputPath}`);
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`\n✅ Successfully generated ${letters.length} pictograph(s)`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node scripts/generate-pictographs.js A B C');
    console.log('   Or: node scripts/generate-pictographs.js --all');
    console.log('\nMake sure dev server is running on localhost:5173');
    process.exit(1);
  }

  let letters = args;

  if (args[0] === '--all') {
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  }

  await generatePictographs(letters);
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
