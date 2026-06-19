/**
 * Performance Budget Checker - A+ Performance Utility
 *
 * 🚀 PERFORMANCE: Runtime checks against performance budgets.
 * Warns in development when budgets are exceeded.
 *
 * Budgets based on Web Vitals thresholds and resource limits.
 */

export interface PerformanceBudget {
  // Timing budgets (ms)
  ttfb: number; // Time to First Byte
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  inp: number; // Interaction to Next Paint
  tti: number; // Time to Interactive

  // Layout stability
  cls: number; // Cumulative Layout Shift

  // Resource budgets
  totalJSSize: number; // Total JS in KB (compressed)
  totalCSSSize: number; // Total CSS in KB (compressed)
  totalImageSize: number; // Total images in KB
  maxRequests: number; // Max number of requests

  // Runtime budgets
  maxLongTasks: number; // Max long tasks (>50ms) per minute
  minFPS: number; // Minimum acceptable FPS
}

// Default budgets based on "Good" Web Vitals thresholds
export const DEFAULT_BUDGET: PerformanceBudget = {
  // Timing (Google's "Good" thresholds)
  ttfb: 800,
  fcp: 1800,
  lcp: 2500,
  inp: 200,
  tti: 3800,

  // Layout stability
  cls: 0.1,

  // Resource sizes (gzipped KB)
  totalJSSize: 350,
  totalCSSSize: 100,
  totalImageSize: 1500,
  maxRequests: 50,

  // Runtime
  maxLongTasks: 10,
  minFPS: 45,
};

interface BudgetViolation {
  metric: keyof PerformanceBudget;
  budget: number;
  actual: number;
  severity: "warning" | "error";
  message: string;
}

class PerformanceBudgetChecker {
  private budget: PerformanceBudget;
  private violations: BudgetViolation[] = [];

  constructor(budget: PerformanceBudget = DEFAULT_BUDGET) {
    this.budget = budget;
  }

  /**
   * Update budget thresholds
   */
  setBudget(budget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...budget };
  }

  /**
   * Check a metric against its budget
   */
  check(
    metric: keyof PerformanceBudget,
    actual: number,
    _options?: { silent?: boolean }
  ): boolean {
    const budget = this.budget[metric];
    let isWithinBudget = true;
    let severity: "warning" | "error" = "warning";
    let message = "";

    // For CLS and FPS, comparison is different
    if (metric === "cls") {
      isWithinBudget = actual <= budget;
      message = `CLS: ${actual.toFixed(4)} (budget: ≤${budget})`;
    } else if (metric === "minFPS") {
      isWithinBudget = actual >= budget;
      message = `FPS: ${actual} (budget: ≥${budget})`;
    } else {
      isWithinBudget = actual <= budget;
      message = `${metric}: ${actual.toFixed(0)}ms (budget: ≤${budget}ms)`;
    }

    // Determine severity (>50% over budget = error)
    if (!isWithinBudget) {
      const overBudgetPercent = Math.abs(actual - budget) / budget;
      severity = overBudgetPercent > 0.5 ? "error" : "warning";

      const violation: BudgetViolation = {
        metric,
        budget,
        actual,
        severity,
        message,
      };
      this.violations.push(violation);

    }

    return isWithinBudget;
  }

  /**
   * Check all timing metrics from Navigation Timing API
   */
  checkNavigationTiming(): void {
    if (typeof window === "undefined") return;

    const entries = performance.getEntriesByType("navigation");
    if (entries.length === 0) return;

    const nav = entries[0] as PerformanceNavigationTiming;

    // TTFB
    const ttfb = nav.responseStart - nav.requestStart;
    this.check("ttfb", ttfb);

    // FCP (need to wait for paint entries)
    const paintEntries = performance.getEntriesByType("paint");
    const fcpEntry = paintEntries.find(
      (e) => e.name === "first-contentful-paint"
    );
    if (fcpEntry) {
      this.check("fcp", fcpEntry.startTime);
    }
  }

  /**
   * Check resource sizes
   */
  checkResources(): void {
    if (typeof window === "undefined") return;

    const resources = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[];

    let totalJS = 0;
    let totalCSS = 0;
    let totalImages = 0;
    let requestCount = 0;

    for (const resource of resources) {
      requestCount++;
      const size = resource.transferSize / 1024; // Convert to KB

      if (resource.initiatorType === "script") {
        totalJS += size;
      } else if (
        resource.initiatorType === "css" ||
        resource.name.endsWith(".css")
      ) {
        totalCSS += size;
      } else if (["img", "image"].includes(resource.initiatorType)) {
        totalImages += size;
      }
    }

    this.check("totalJSSize", totalJS);
    this.check("totalCSSSize", totalCSS);
    this.check("totalImageSize", totalImages);
    this.check("maxRequests", requestCount);
  }

  /**
   * Get all violations
   */
  getViolations(): BudgetViolation[] {
    return [...this.violations];
  }

  /**
   * Generate report
   */
  report(): void {
    this.checkNavigationTiming();
    this.checkResources();
  }

  /**
   * Clear violations
   */
  clear(): void {
    this.violations = [];
  }
}

// Singleton instance
export const budgetChecker = new PerformanceBudgetChecker();

// Auto-check on page load in development
if (typeof window !== "undefined") {
  if (
    window.location.hostname.includes("localhost") ||
    window.location.hostname.includes("127.0.0.1")
  ) {
    // Wait for page to fully load before checking
    window.addEventListener("load", () => {
      setTimeout(() => {
        budgetChecker.report();
      }, 3000); // Wait 3s for all resources
    });

    // Expose to window for debugging (localhost only)
    (
      window as unknown as { budgetChecker: PerformanceBudgetChecker }
    ).budgetChecker = budgetChecker;
  }
}
