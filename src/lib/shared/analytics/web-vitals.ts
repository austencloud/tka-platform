/**
 * Web Vitals Tracking
 *
 * Tracks Core Web Vitals metrics for performance monitoring.
 * Logs to console in development, can be extended to send to analytics service.
 *
 * Metrics tracked:
 * - CLS (Cumulative Layout Shift) - visual stability
 * - FID (First Input Delay) - interactivity (replaced by INP in 2024)
 * - INP (Interaction to Next Paint) - responsiveness
 * - LCP (Largest Contentful Paint) - loading performance
 * - FCP (First Contentful Paint) - perceived load speed
 * - TTFB (Time to First Byte) - server response time
 */

import type { Metric } from "web-vitals";
import { bootProfiler } from "./boot-profiler";

// Thresholds based on Google's recommendations
const THRESHOLDS = {
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FID: { good: 100, needsImprovement: 300 },
  INP: { good: 200, needsImprovement: 500 },
  LCP: { good: 2500, needsImprovement: 4000 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
} as const;

type MetricName = keyof typeof THRESHOLDS;
let initialized = false;

function getRating(
  name: string,
  value: number
): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name as MetricName];
  if (!threshold) return "good";

  if (value <= threshold.good) return "good";
  if (value <= threshold.needsImprovement) return "needs-improvement";
  return "poor";
}

/**
 * Feed field metrics into the development profiler. PostHog captures its native
 * `$web_vitals` event separately, so duplicating the metrics here would inflate
 * event volume and produce two competing field datasets.
 */
function handleMetric(metric: Metric): void {
  const rating = getRating(metric.name, metric.value);

  bootProfiler.recordVital({
    name: metric.name,
    value: metric.value,
    rating,
    delta: metric.delta,
  });
}

/**
 * Initialize web vitals tracking
 * Call this once in the root layout
 */
export async function initWebVitals(): Promise<void> {
  // Only run in browser
  if (typeof window === "undefined" || initialized) return;

  // Dynamic import to ensure tree-shaking in SSR
  const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals");
  if (initialized) return;
  initialized = true;

  // Track all Core Web Vitals
  onCLS(handleMetric);
  onFCP(handleMetric);
  onINP(handleMetric); // INP replaced FID as of March 2024
  onLCP(handleMetric);
  onTTFB(handleMetric);
}

/**
 * Get a summary of current performance
 * Useful for debugging or displaying in admin panel
 */
export function getPerformanceSummary(): Record<string, unknown> {
  if (typeof window === "undefined") return {};

  const navigation = performance.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming;

  if (!navigation) return {};

  return {
    // Navigation timing
    dnsLookup: Math.round(
      navigation.domainLookupEnd - navigation.domainLookupStart
    ),
    tcpConnect: Math.round(navigation.connectEnd - navigation.connectStart),
    ttfb: Math.round(navigation.responseStart - navigation.requestStart),
    contentDownload: Math.round(
      navigation.responseEnd - navigation.responseStart
    ),
    domParsing: Math.round(navigation.domInteractive - navigation.responseEnd),
    domContentLoaded: Math.round(
      navigation.domContentLoadedEventEnd - navigation.startTime
    ),
    fullLoad: Math.round(navigation.loadEventEnd - navigation.startTime),

    // Resource counts
    resourceCount: performance.getEntriesByType("resource").length,

    // Memory (if available)
    ...("memory" in performance && {
      usedJSHeapSize:
        Math.round(
          (performance as Performance & { memory: { usedJSHeapSize: number } })
            .memory.usedJSHeapSize /
            1024 /
            1024
        ) + "MB",
    }),
  };
}
