#!/usr/bin/env node
/**
 * CLI Cache Benchmark Runner
 *
 * Runs the cache benchmark headlessly using Puppeteer and outputs results.
 *
 * Usage:
 *   node scripts/run-cache-benchmark.js [sequenceCount]
 *   node scripts/run-cache-benchmark.js 50
 */

import puppeteer from 'puppeteer';

const sequenceCount = parseInt(process.argv[2] || '20', 10);
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function runBenchmark() {
  console.log(`\n🚀 Starting cache benchmark with ${sequenceCount} sequences...\n`);
  console.log(`Connecting to ${APP_URL}...\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console output
  page.on('console', msg => {
    const text = msg.text();
    // Filter out noise, only show benchmark-related logs
    if (text.includes('[Render]') ||
        text.includes('[CacheBenchmark]') ||
        text.includes('Loading sequences') ||
        text.includes('Loaded ') ||
        text.includes('Failed to load') ||
        text.includes('Sample beat') ||
        text.includes('PASS') ||
        text.includes('BENCHMARK') ||
        text.includes('━') ||
        text.includes('═') ||
        text.includes('┌') ||
        text.includes('│') ||
        text.includes('└') ||
        text.includes('├') ||
        text.includes('📊') ||
        text.includes('🧪') ||
        text.includes('📈') ||
        text.includes('✓') ||
        text.includes('→') ||
        text.includes('⚠') ||
        text.includes('avg') ||
        text.includes('Loaded') ||
        text.includes('Testing') ||
        text.includes('INTERPRETATION') ||
        text.includes('RENDER TIMES') ||
        text.includes('CACHE EFFECTIVENESS') ||
        text.includes('TOTALS') ||
        text.includes('Unique') ||
        text.includes('Shared') ||
        text.includes('Memory cache') ||
        text.includes('Sequences tested') ||
        text.includes('beats rendered') ||
        text.includes('cache rate') ||
        text.includes('speedup') ||
        text.includes('reuse')) {
      console.log(text);
    }
  });

  page.on('pageerror', err => {
    console.error('Page error:', err.message);
  });

  try {
    // Navigate to the app (use domcontentloaded for faster initial load)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for the benchmark utility to load
    await page.waitForFunction(() => typeof window.runCacheBenchmark === 'function', {
      timeout: 30000
    });

    // Give the app a moment to fully initialize
    await new Promise(r => setTimeout(r, 2000));

    console.log('✓ Benchmark utility loaded\n');

    // Run the benchmark
    const result = await page.evaluate(async (count) => {
      const result = await window.runCacheBenchmark(count);
      return result;
    }, sequenceCount);

    if (result) {
      console.log('\n✅ Benchmark completed successfully!\n');

      // Output a machine-readable summary
      console.log('--- SUMMARY (JSON) ---');
      console.log(JSON.stringify({
        sequences: result.coldPass.totalSequences,
        totalBeats: result.coldPass.totalBeats,
        coldAvgMs: Math.round(result.summary.coldAvgMs),
        warmAvgMs: Math.round(result.summary.warmAvgMs),
        hotAvgMs: Math.round(result.summary.hotAvgMs),
        l1Speedup: result.summary.l1Speedup,
        l2Speedup: result.summary.l2Speedup,
        crossSequenceReuse: result.crossSequenceBenefit.reuseRate.toFixed(1) + '%',
        uniquePictographs: result.crossSequenceBenefit.uniquePictographs,
        sharedPictographs: result.crossSequenceBenefit.sharedPictographs,
      }, null, 2));
    } else {
      console.error('❌ Benchmark returned null - check for errors above');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBenchmark().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
