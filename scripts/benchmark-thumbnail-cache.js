#!/usr/bin/env node
/**
 * Benchmark Thumbnail Cache Performance
 *
 * Measures rendering speed with cold vs warm cache to verify
 * the two-layer pictograph caching system is working.
 *
 * Usage:
 *   node scripts/benchmark-thumbnail-cache.js
 *
 * Prerequisites:
 *   - Dev server running on localhost:5173
 *   - Playwright installed
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const DISCOVER_PATH = '/discover/sequences';
const SCROLL_ITERATIONS = 5;
const SCROLL_DELAY = 500; // ms between scrolls
const WAIT_FOR_RENDER = 3000; // ms to wait for thumbnails to render
const PAGE_LOAD_TIMEOUT = 60000; // 60 second timeout for page loads

async function runBenchmark() {
  console.log('🚀 Starting Thumbnail Cache Benchmark\n');
  console.log('=' .repeat(60));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  // Collect console logs for cache stats
  const cacheStats = [];
  page.on('console', msg => {
    const text = msg.text();
    // Capture pictograph cache logs
    if (text.includes('[PictographCache]') || text.includes('L1=') || text.includes('L2=')) {
      cacheStats.push(text);
      console.log('  📊 ' + text);
    }
    // Capture blob cache operations
    if (text.includes('[ImageComposer]') || text.includes('blob')) {
      console.log('  💾 ' + text);
    }
  });

  try {
    // ============================================
    // TEST 1: Cold Cache (Clear IndexedDB first)
    // ============================================
    console.log('\n📊 TEST 1: COLD CACHE (First Load)\n');

    // Clear IndexedDB caches (including new blob cache)
    await page.goto(BASE_URL);
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name?.includes('pictograph') || db.name?.includes('thumbnail') || db.name?.includes('blob')) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    });
    console.log('  ✓ Cleared IndexedDB caches (including blob cache)');

    // Navigate to Discover
    const coldStartTime = Date.now();
    await page.goto(BASE_URL + DISCOVER_PATH, { timeout: PAGE_LOAD_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');
    // Wait for the grid to appear
    await page.waitForSelector('[class*="grid"], [class*="Grid"]', { timeout: PAGE_LOAD_TIMEOUT }).catch(() => {});

    // Wait for initial thumbnails
    await page.waitForTimeout(WAIT_FOR_RENDER);

    // Scroll to trigger more thumbnail renders
    console.log('  ⏳ Scrolling to load more thumbnails...');
    for (let i = 0; i < SCROLL_ITERATIONS; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(SCROLL_DELAY);
    }

    // Wait for renders to complete
    await page.waitForTimeout(WAIT_FOR_RENDER);
    const coldEndTime = Date.now();
    const coldDuration = coldEndTime - coldStartTime;

    // Get final cache stats - try multiple paths to find the image composer
    const coldStats = await page.evaluate(async () => {
      try {
        // Try window globals first
        let composer = window.__renderContainer?.items?.imageComposer
                    || window.container?.items?.imageComposer;

        if (!composer) {
          // Wait a moment for services to initialize
          await new Promise(r => setTimeout(r, 500));
          composer = window.__renderContainer?.items?.imageComposer
                  || window.container?.items?.imageComposer;
        }

        if (composer && typeof composer.getCacheStats === 'function') {
          const stats = composer.getCacheStats();
          const l1Stats = await composer.getLayer1Stats();
          return { ...stats, l1IndexedDB: l1Stats };
        }
      } catch (e) {
        return { error: e.message };
      }
      return null;
    });

    console.log(`\n  ⏱️  Cold cache total time: ${coldDuration}ms`);
    if (coldStats) {
      console.log(`  📈 Cache stats:`, JSON.stringify(coldStats, null, 2));
    } else {
      console.log(`  ⚠️  Could not access cache stats`);
    }

    // ============================================
    // TEST 2: Warm Cache (Page Refresh)
    // ============================================
    console.log('\n📊 TEST 2: WARM CACHE (After Refresh)\n');

    // Refresh page (IndexedDB cache should persist)
    const warmStartTime = Date.now();
    await page.reload({ timeout: PAGE_LOAD_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[class*="grid"], [class*="Grid"]', { timeout: PAGE_LOAD_TIMEOUT }).catch(() => {});

    // Wait for initial thumbnails
    await page.waitForTimeout(WAIT_FOR_RENDER);

    // Scroll same amount
    console.log('  ⏳ Scrolling to load more thumbnails...');
    for (let i = 0; i < SCROLL_ITERATIONS; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(SCROLL_DELAY);
    }

    // Wait for renders to complete
    await page.waitForTimeout(WAIT_FOR_RENDER);
    const warmEndTime = Date.now();
    const warmDuration = warmEndTime - warmStartTime;

    // Get final cache stats
    const warmStats = await page.evaluate(async () => {
      try {
        let composer = window.__renderContainer?.items?.imageComposer
                    || window.container?.items?.imageComposer;
        if (composer && typeof composer.getCacheStats === 'function') {
          const stats = composer.getCacheStats();
          const l1Stats = await composer.getLayer1Stats();
          return { ...stats, l1IndexedDB: l1Stats };
        }
      } catch (e) {
        return { error: e.message };
      }
      return null;
    });

    console.log(`\n  ⏱️  Warm cache total time: ${warmDuration}ms`);
    if (warmStats) {
      console.log(`  📈 Cache stats:`, JSON.stringify(warmStats, null, 2));
    } else {
      console.log(`  ⚠️  Could not access cache stats`);
    }

    // ============================================
    // TEST 3: Hot Cache (Same Session Scroll)
    // ============================================
    console.log('\n📊 TEST 3: HOT CACHE (Scroll Back Up)\n');

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const hotStartTime = Date.now();

    // Scroll down again (should hit L2 memory cache)
    console.log('  ⏳ Re-scrolling (should hit memory cache)...');
    for (let i = 0; i < SCROLL_ITERATIONS; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(SCROLL_DELAY);
    }

    await page.waitForTimeout(WAIT_FOR_RENDER);
    const hotEndTime = Date.now();
    const hotDuration = hotEndTime - hotStartTime;

    const hotStats = await page.evaluate(async () => {
      try {
        let composer = window.__renderContainer?.items?.imageComposer
                    || window.container?.items?.imageComposer;
        if (composer && typeof composer.getCacheStats === 'function') {
          const stats = composer.getCacheStats();
          const l1Stats = await composer.getLayer1Stats();
          return { ...stats, l1IndexedDB: l1Stats };
        }
      } catch (e) {
        return { error: e.message };
      }
      return null;
    });

    console.log(`\n  ⏱️  Hot cache total time: ${hotDuration}ms`);
    if (hotStats) {
      console.log(`  📈 Cache stats:`, JSON.stringify(hotStats, null, 2));
    } else {
      console.log(`  ⚠️  Could not access cache stats`);
    }

    // ============================================
    // RESULTS SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 BENCHMARK RESULTS SUMMARY\n');
    console.log(`  Cold Cache (first load):    ${coldDuration}ms`);
    console.log(`  Warm Cache (after refresh): ${warmDuration}ms`);
    console.log(`  Hot Cache (same session):   ${hotDuration}ms`);
    console.log('');

    const warmImprovement = ((coldDuration - warmDuration) / coldDuration * 100).toFixed(1);
    const hotImprovement = ((coldDuration - hotDuration) / coldDuration * 100).toFixed(1);

    console.log(`  🚀 Warm cache speedup: ${warmImprovement}% faster than cold`);
    console.log(`  🚀 Hot cache speedup:  ${hotImprovement}% faster than cold`);
    console.log('');

    if (parseFloat(warmImprovement) > 10) {
      console.log('  ✅ IndexedDB cache is providing significant speedup!');
    } else {
      console.log('  ⚠️  IndexedDB cache speedup is minimal - may need investigation');
    }

    if (parseFloat(hotImprovement) > 20) {
      console.log('  ✅ Memory cache is providing significant speedup!');
    } else {
      console.log('  ⚠️  Memory cache speedup is minimal - may need investigation');
    }

    console.log('\n' + '='.repeat(60));

    // Keep browser open for inspection
    console.log('\n👀 Browser staying open for inspection. Press Ctrl+C to close.\n');
    await page.waitForTimeout(60000); // Keep open for 1 minute

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    await browser.close();
  }
}

runBenchmark().catch(console.error);
