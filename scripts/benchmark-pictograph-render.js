#!/usr/bin/env node
/**
 * Benchmark Pictograph Render Performance
 *
 * Measures raw pictograph rendering speed to verify
 * the two-layer caching system is working.
 *
 * This navigates to the app and runs the cache benchmark utility
 * which is exposed globally in dev mode via window.runCacheBenchmark()
 *
 * Usage:
 *   node scripts/benchmark-pictograph-render.js
 *
 * Prerequisites:
 *   - Dev server running on localhost:5173
 *   - Playwright installed
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function runBenchmark() {
  console.log('🚀 Starting Pictograph Render Benchmark\n');
  console.log('=' .repeat(60));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  // Collect console logs
  page.on('console', msg => {
    console.log(msg.text());
  });

  try {
    // Navigate to the app
    console.log('\n📍 Navigating to app...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');

    // Wait for hooks.client.ts to load the benchmark utility
    console.log('⏳ Waiting for benchmark utility to load...');

    // Wait up to 10 seconds for the benchmark to become available
    let hasBenchmark = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      hasBenchmark = await page.evaluate(() => {
        return typeof window.runCacheBenchmark === 'function';
      });
      if (hasBenchmark) break;
    }

    if (!hasBenchmark) {
      console.log('❌ window.runCacheBenchmark not found after 10 seconds.');
      console.log('   The benchmark utility is loaded in dev mode via hooks.client.ts');
      console.log('   Check console for any import errors.');
      await page.waitForTimeout(5000);
      return;
    }

    console.log('✓ Benchmark utility loaded\n');

    // Run the benchmark
    console.log('🔬 Running benchmark (this takes ~30 seconds)...\n');

    const result = await page.evaluate(async () => {
      // Run with 3 iterations
      return await window.runCacheBenchmark(3);
    });

    if (result) {
      // Print additional analysis
      console.log('\n' + '='.repeat(60));
      console.log('📊 DETAILED ANALYSIS\n');

      const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
      const coldAvg = avg(result.coldRenderMs);
      const warmAvg = avg(result.warmRenderMs);
      const hotAvg = avg(result.hotRenderMs);

      // Calculate absolute time savings
      const warmSavingsMs = coldAvg - warmAvg;
      const hotSavingsMs = coldAvg - hotAvg;

      console.log(`Per-sequence time savings:`);
      console.log(`  L1 (IndexedDB blob): ${warmSavingsMs.toFixed(0)}ms saved per sequence`);
      console.log(`  L2 (Memory):         ${hotSavingsMs.toFixed(0)}ms saved per sequence`);

      // Estimate for Discover page (assume 20 visible thumbnails)
      const thumbnailsVisible = 20;
      console.log(`\nEstimated savings for ${thumbnailsVisible} thumbnails:`);
      console.log(`  L1 warm cache: ${(warmSavingsMs * thumbnailsVisible / 1000).toFixed(1)}s total`);
      console.log(`  L2 hot cache:  ${(hotSavingsMs * thumbnailsVisible / 1000).toFixed(1)}s total`);

      console.log('='.repeat(60));
    }

    // Keep browser open briefly for inspection
    console.log('\n👀 Browser staying open for 10s. Press Ctrl+C to close.\n');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    await browser.close();
  }
}

runBenchmark().catch(console.error);
