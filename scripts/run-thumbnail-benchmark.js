#!/usr/bin/env node
/**
 * Thumbnail Benchmark CLI
 *
 * Runs the thumbnail caching benchmark autonomously and outputs results.
 *
 * Usage:
 *   node scripts/run-thumbnail-benchmark.js [options]
 *
 * Options:
 *   --count=N       Number of sequences to test (default: 50)
 *   --iterations=N  Number of iterations (default: 2)
 *   --mode=MODE     Benchmark mode: 'standard' or 'visibility' (default: standard)
 *   --clear-cache   Clear cache between iterations
 *   --port=N        Dev server port (default: 5173)
 *   --timeout=N     Timeout in seconds (default: 300)
 *   --json          Output only JSON results
 *   --output=FILE   Save results to JSON file for later comparison
 *   --compare=FILE  Compare against a previous benchmark run
 *
 * Requirements:
 *   - Dev server must be running (npm run dev)
 *   - Playwright must be installed (npx playwright install chromium)
 *
 * Examples:
 *   node scripts/run-thumbnail-benchmark.js
 *   node scripts/run-thumbnail-benchmark.js --count=100 --iterations=3
 *   node scripts/run-thumbnail-benchmark.js --json > results.json
 *   node scripts/run-thumbnail-benchmark.js --output=baseline.json
 *   node scripts/run-thumbnail-benchmark.js --compare=baseline.json
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  count: 50,
  iterations: 2,
  mode: 'standard', // 'standard' or 'visibility'
  clearCache: false,
  port: 5173,
  timeout: 300,
  json: false,
  output: null,
  compare: null,
};

for (const arg of args) {
  if (arg.startsWith('--count=')) {
    options.count = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--iterations=')) {
    options.iterations = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--mode=')) {
    const mode = arg.split('=')[1];
    if (mode === 'visibility' || mode === 'visibility-change') {
      options.mode = 'visibility';
    }
  } else if (arg === '--clear-cache') {
    options.clearCache = true;
  } else if (arg.startsWith('--port=')) {
    options.port = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--timeout=')) {
    options.timeout = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--json') {
    options.json = true;
  } else if (arg.startsWith('--output=')) {
    options.output = arg.split('=')[1];
  } else if (arg.startsWith('--compare=')) {
    options.compare = arg.split('=')[1];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Thumbnail Benchmark CLI

Usage:
  node scripts/run-thumbnail-benchmark.js [options]

Options:
  --count=N       Number of sequences to test (default: 50)
  --iterations=N  Number of iterations (default: 2)
  --mode=MODE     Benchmark mode: 'standard' or 'visibility' (default: standard)
                  'visibility' runs 5 fixed iterations testing cache invalidation
  --clear-cache   Clear cache between iterations
  --port=N        Dev server port (default: 5173)
  --timeout=N     Timeout in seconds (default: 300)
  --json          Output only JSON results
  --output=FILE   Save results to JSON file for later comparison
  --compare=FILE  Compare against a previous benchmark run
  --help          Show this help

Examples:
  # Standard benchmark (cache hit/miss)
  node scripts/run-thumbnail-benchmark.js --count=50 --iterations=2

  # Visibility change benchmark (tests cache invalidation on visibility toggle)
  node scripts/run-thumbnail-benchmark.js --mode=visibility --count=30
`);
    process.exit(0);
  }
}

function log(message) {
  if (!options.json) {
    console.log(message);
  }
}

async function runBenchmark() {
  log('🚀 Starting Thumbnail Benchmark');
  log(`   Mode: ${options.mode}`);
  log(`   Sequences: ${options.count}`);
  if (options.mode === 'standard') {
    log(`   Iterations: ${options.iterations}`);
  } else {
    log(`   Iterations: 5 (fixed for visibility test)`);
  }
  log(`   Clear cache: ${options.clearCache}`);
  log('');

  // Build URL with parameters
  const params = new URLSearchParams({
    autorun: 'true',
    count: options.count.toString(),
    iterations: options.iterations.toString(),
  });
  if (options.clearCache) {
    params.set('clearCache', 'true');
  }
  if (options.mode === 'visibility') {
    params.set('mode', 'visibility');
  }
  const url = `http://localhost:${options.port}/test/thumbnail-benchmark?${params}`;

  let browser;
  try {
    log('📦 Launching browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Listen for console messages
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[Benchmark]') || text.includes('[ThumbnailMetrics]')) {
        log(`   ${text}`);
      }
    });

    log(`🌐 Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    log('⏳ Waiting for benchmark to complete...');

    // Wait for completion with timeout
    const timeoutMs = options.timeout * 1000;
    const startTime = Date.now();

    while (true) {
      const complete = await page.getAttribute('[data-benchmark-complete]', 'data-benchmark-complete');
      if (complete === 'true') {
        break;
      }

      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Timeout after ${options.timeout} seconds`);
      }

      // Check for errors
      const errorEl = await page.$('.error');
      if (errorEl) {
        const errorText = await errorEl.textContent();
        throw new Error(`Benchmark error: ${errorText}`);
      }

      await page.waitForTimeout(1000);
    }

    // Get results
    const resultsJson = await page.getAttribute('[data-benchmark-results]', 'data-benchmark-results');
    const results = JSON.parse(resultsJson);

    await browser.close();

    // Save results to file if requested
    if (options.output) {
      const outputData = {
        ...results,
        savedAt: new Date().toISOString(),
        config: { count: options.count, iterations: options.iterations },
      };
      writeFileSync(options.output, JSON.stringify(outputData, null, 2));
      log(`📁 Results saved to ${options.output}`);
    }

    // Output results
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      log('');
      log('✅ Benchmark Complete!');
      log('');
      printResults(results);

      // Compare against baseline if requested
      if (options.compare) {
        log('');
        printComparison(results, options.compare);
      }
    }

    return results;

  } catch (error) {
    if (browser) {
      await browser.close();
    }

    if (options.json) {
      console.log(JSON.stringify({ error: error.message }));
    } else {
      console.error(`❌ Error: ${error.message}`);
      if (error.message.includes('ECONNREFUSED')) {
        console.error('   Make sure the dev server is running: npm run dev');
      }
    }
    process.exit(1);
  }
}

function printResults(results) {
  const m = results.summary.firstRunMetrics;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    THUMBNAIL BENCHMARK RESULTS                 ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Mode:                  ${results.mode || 'standard'}`);
  console.log(`  Sequences tested:      ${results.sequenceCount}`);
  console.log(`  Iterations:            ${results.iterations.length}`);
  console.log(`  Cache effectiveness:   ${results.summary.cacheEffectiveness.toFixed(1)}% faster on 2nd run`);
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    CACHE HIT RATES (First Run)              │');
  console.log('├─────────────────┬────────┬─────────────┬────────────────────┤');
  console.log('│ Layer           │ Hits   │ Rate        │ Avg Time           │');
  console.log('├─────────────────┼────────┼─────────────┼────────────────────┤');
  printRow('Static (bundled)', m.byLayer.static, m.hitRateByLayer.static, m.avgTimeByLayer.static);
  printRow('Local (IndexedDB)', m.byLayer.local, m.hitRateByLayer.local, m.avgTimeByLayer.local);
  printRow('Cloud (Firebase)', m.byLayer.cloud, m.hitRateByLayer.cloud, m.avgTimeByLayer.cloud);
  printRow('Render (fallback)', m.byLayer.render, m.hitRateByLayer.render, m.avgTimeByLayer.render);
  printRow('Failed', m.byLayer.failed, m.hitRateByLayer.failed, '-', true);
  console.log('└─────────────────┴────────┴─────────────┴────────────────────┘');
  console.log('');

  if (results.summary.cachedRunMetrics) {
    const c = results.summary.cachedRunMetrics;
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    CACHE HIT RATES (Cached Run)             │');
    console.log('├─────────────────┬────────┬─────────────┬────────────────────┤');
    console.log('│ Layer           │ Hits   │ Rate        │ Avg Time           │');
    console.log('├─────────────────┼────────┼─────────────┼────────────────────┤');
    printRow('Static (bundled)', c.byLayer.static, c.hitRateByLayer.static, c.avgTimeByLayer.static);
    printRow('Local (IndexedDB)', c.byLayer.local, c.hitRateByLayer.local, c.avgTimeByLayer.local, false, true);
    printRow('Cloud (Firebase)', c.byLayer.cloud, c.hitRateByLayer.cloud, c.avgTimeByLayer.cloud);
    printRow('Render (fallback)', c.byLayer.render, c.hitRateByLayer.render, c.avgTimeByLayer.render);
    console.log('└─────────────────┴────────┴─────────────┴────────────────────┘');
    console.log('');
  }

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    PERFORMANCE METRICS                       │');
  console.log('├─────────────────────────────────┬───────────────────────────┤');
  console.log(`│ Cancel Rate                     │ ${m.cancelRate.toFixed(1).padStart(23)}% │`);
  console.log(`│ Render Failure Rate             │ ${m.renderFailureRate.toFixed(1).padStart(23)}% │`);
  console.log(`│ Upload Success Rate             │ ${m.uploadSuccessRate.toFixed(1).padStart(23)}% │`);
  console.log(`│ Queue High Water Mark           │ ${String(m.queueHighWaterMark).padStart(24)} │`);
  console.log(`│ Avg Queue Wait                  │ ${(m.avgQueueWaitTime.toFixed(0) + 'ms').padStart(24)} │`);
  console.log(`│ Avg Render Time                 │ ${(m.avgRenderTime.toFixed(0) + 'ms').padStart(24)} │`);
  console.log('└─────────────────────────────────┴───────────────────────────┘');
  console.log('');

  // Timing distribution - this is what matters for user experience
  if (m.timeDistribution && m.timeDistribution.count > 0) {
    const d = m.timeDistribution;
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    TIMING DISTRIBUTION                       │');
    console.log('├─────────────────────────────────┬───────────────────────────┤');
    console.log(`│ P50 (median)                    │ ${(d.p50.toFixed(0) + 'ms').padStart(24)} │`);
    console.log(`│ P95 (95% of users faster)       │ ${(d.p95.toFixed(0) + 'ms').padStart(24)} │`);
    console.log(`│ P99 (99% of users faster)       │ ${(d.p99.toFixed(0) + 'ms').padStart(24)} │`);
    console.log(`│ Std Dev                         │ ${(d.stdDev.toFixed(0) + 'ms').padStart(24)} │`);
    console.log(`│ Min / Max                       │ ${(d.min.toFixed(0) + 'ms / ' + d.max.toFixed(0) + 'ms').padStart(24)} │`);
    console.log('└─────────────────────────────────┴───────────────────────────┘');
    console.log('');
  }

  // Visibility change analysis (if in visibility mode)
  if (results.summary.visibilityChange) {
    const v = results.summary.visibilityChange;
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    VISIBILITY CHANGE ANALYSIS               │');
    console.log('├─────────────────────────────────┬───────────────────────────┤');
    console.log(`│ Warm cache hit rate             │ ${(v.warmCacheHitRate.toFixed(1) + '%').padStart(24)} │`);
    console.log(`│ Overlay change hit rate (TKA)   │ ${(v.overlayChangeHitRate.toFixed(1) + '%').padStart(24)} │`);
    console.log(`│ Original cache survival         │ ${(v.originalCacheSurvival.toFixed(1) + '%').padStart(24)} │`);
    console.log(`│ Grid change hit rate            │ ${(v.gridChangeHitRate.toFixed(1) + '%').padStart(24)} │`);
    console.log('├─────────────────────────────────┴───────────────────────────┤');

    if (v.overlayChangeFullyInvalidated) {
      console.log('│ ❌ TKA toggle INVALIDATES cache - all thumbnails re-render  │');
    } else {
      console.log('│ ✅ TKA toggle preserves cache                               │');
    }

    if (v.gridChangeFullyInvalidated) {
      console.log('│ ❌ Grid change INVALIDATES cache - all thumbnails re-render │');
    } else {
      console.log('│ ✅ Grid change preserves cache                              │');
    }

    if (v.originalCacheSurvival < 50) {
      console.log('│ ❌ Original cache lost after visibility toggle              │');
    } else {
      console.log('│ ✅ Original cache survives visibility toggle                │');
    }

    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');

    // Key insight
    if (v.overlayChangeFullyInvalidated || v.gridChangeFullyInvalidated) {
      console.log('📊 KEY INSIGHT: Visibility changes cause full cache invalidation.');
      console.log('   → Compositional layer caching would prevent this.');
      console.log('');
    }
  }

  // Recommendations
  console.log('💡 RECOMMENDATIONS:');
  let hasRecommendation = false;

  if (m.cancelRate > 20) {
    console.log(`   ⚠️  High cancel rate (${m.cancelRate.toFixed(0)}%) - preloading might help`);
    hasRecommendation = true;
  }
  if (m.renderFailureRate > 5) {
    console.log(`   ⚠️  Render failure rate ${m.renderFailureRate.toFixed(0)}% - retry logic would help`);
    hasRecommendation = true;
  }
  if (m.queueHighWaterMark > 10) {
    console.log(`   ⚠️  Queue peaked at ${m.queueHighWaterMark} - consider increasing concurrency`);
    hasRecommendation = true;
  }
  if (m.hitRateByLayer.local > 50 && results.summary.cachedRunMetrics) {
    console.log(`   ✅  Great local cache hit rate (${m.hitRateByLayer.local.toFixed(0)}%)`);
    hasRecommendation = true;
  }
  if (m.uploadSuccessRate < 90 && m.byLayer.render > 0) {
    console.log(`   ⚠️  Upload success rate only ${m.uploadSuccessRate.toFixed(0)}% - check cloud connectivity`);
    hasRecommendation = true;
  }
  if (results.summary.cacheEffectiveness > 50) {
    console.log(`   ✅  Caching is very effective (${results.summary.cacheEffectiveness.toFixed(0)}% faster on repeat)`);
    hasRecommendation = true;
  }

  // P95-based recommendations
  if (m.timeDistribution && m.timeDistribution.count >= 20) {
    const d = m.timeDistribution;
    if (d.stdDev > d.mean * 0.8) {
      console.log(`   📊  High variance (stdDev ${d.stdDev.toFixed(0)}ms vs mean ${d.mean.toFixed(0)}ms) - inconsistent performance`);
      hasRecommendation = true;
    }
    if (d.p95 > d.p50 * 3 && d.p95 > 500) {
      console.log(`   🐢  Tail latency: P95 (${d.p95.toFixed(0)}ms) is ${(d.p95 / d.p50).toFixed(1)}x median - 5% waiting much longer`);
      hasRecommendation = true;
    }
    if (d.p95 < 200) {
      console.log(`   ✅  Excellent P95 (${d.p95.toFixed(0)}ms) - 95% of thumbnails load quickly`);
      hasRecommendation = true;
    }
  }

  if (!hasRecommendation) {
    console.log('   (No issues detected)');
  }
  console.log('');
}

function printRow(label, hits, rate, time, isFailed = false, isHighlight = false) {
  const labelPad = label.padEnd(15);
  const hitsPad = String(hits).padStart(6);
  const ratePad = (rate.toFixed(1) + '%').padStart(11);
  const timePad = typeof time === 'number' ? (time.toFixed(0) + 'ms').padStart(18) : time.padStart(18);

  if (isFailed && hits > 0) {
    console.log(`│ ${labelPad} │ ${hitsPad} │ ${ratePad} │ ${timePad} │ ⚠️`);
  } else if (isHighlight) {
    console.log(`│ ${labelPad} │ ${hitsPad} │ ${ratePad} │ ${timePad} │ ⬆️`);
  } else {
    console.log(`│ ${labelPad} │ ${hitsPad} │ ${ratePad} │ ${timePad} │`);
  }
}

function printComparison(current, baselineFile) {
  if (!existsSync(baselineFile)) {
    console.log(`⚠️  Baseline file not found: ${baselineFile}`);
    return;
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselineFile, 'utf-8'));
  } catch (e) {
    console.log(`⚠️  Could not parse baseline file: ${e.message}`);
    return;
  }

  const currM = current.summary.firstRunMetrics;
  const baseM = baseline.summary?.firstRunMetrics;

  if (!baseM) {
    console.log(`⚠️  Baseline file missing metrics data`);
    return;
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    COMPARISON WITH BASELINE                    ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  if (baseline.savedAt) {
    console.log(`  Baseline from: ${baseline.savedAt}`);
    console.log('');
  }

  // Compare key metrics
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    METRIC COMPARISON                         │');
  console.log('├─────────────────────────────┬──────────┬──────────┬─────────┤');
  console.log('│ Metric                      │ Baseline │ Current  │ Change  │');
  console.log('├─────────────────────────────┼──────────┼──────────┼─────────┤');

  // P50
  if (currM.timeDistribution && baseM.timeDistribution) {
    printComparisonRow('P50 (median)', baseM.timeDistribution.p50, currM.timeDistribution.p50, 'ms', true);
    printComparisonRow('P95', baseM.timeDistribution.p95, currM.timeDistribution.p95, 'ms', true);
    printComparisonRow('P99', baseM.timeDistribution.p99, currM.timeDistribution.p99, 'ms', true);
    printComparisonRow('Std Dev', baseM.timeDistribution.stdDev, currM.timeDistribution.stdDev, 'ms', true);
  }

  printComparisonRow('Cancel Rate', baseM.cancelRate, currM.cancelRate, '%', true);
  printComparisonRow('Render Failure', baseM.renderFailureRate, currM.renderFailureRate, '%', true);
  printComparisonRow('Local Hit Rate', baseM.hitRateByLayer.local, currM.hitRateByLayer.local, '%', false);

  console.log('└─────────────────────────────┴──────────┴──────────┴─────────┘');
  console.log('');

  // Overall verdict
  let regressions = 0;
  let improvements = 0;

  if (currM.timeDistribution && baseM.timeDistribution) {
    const p95Change = (currM.timeDistribution.p95 - baseM.timeDistribution.p95) / baseM.timeDistribution.p95 * 100;
    if (p95Change > 10) regressions++;
    if (p95Change < -10) improvements++;
  }

  if (currM.cancelRate - baseM.cancelRate > 5) regressions++;
  if (baseM.cancelRate - currM.cancelRate > 5) improvements++;

  if (regressions > 0 && improvements === 0) {
    console.log('📉 VERDICT: Performance regression detected');
  } else if (improvements > 0 && regressions === 0) {
    console.log('📈 VERDICT: Performance improved');
  } else if (regressions > 0 && improvements > 0) {
    console.log('📊 VERDICT: Mixed results - some improved, some regressed');
  } else {
    console.log('➡️  VERDICT: No significant change');
  }
  console.log('');
}

function printComparisonRow(label, baseline, current, unit, lowerIsBetter) {
  const baseVal = baseline?.toFixed?.(0) ?? '-';
  const currVal = current?.toFixed?.(0) ?? '-';

  let change = '-';
  let indicator = '';

  if (typeof baseline === 'number' && typeof current === 'number' && baseline > 0) {
    const pctChange = ((current - baseline) / baseline) * 100;
    change = (pctChange >= 0 ? '+' : '') + pctChange.toFixed(0) + '%';

    if (Math.abs(pctChange) > 5) {
      const isImprovement = lowerIsBetter ? pctChange < 0 : pctChange > 0;
      indicator = isImprovement ? ' ✅' : ' ⚠️';
    }
  }

  const labelPad = label.padEnd(27);
  const basePad = (baseVal + unit).padStart(8);
  const currPad = (currVal + unit).padStart(8);
  const changePad = (change + indicator).padStart(7);

  console.log(`│ ${labelPad} │ ${basePad} │ ${currPad} │ ${changePad} │`);
}

runBenchmark();
