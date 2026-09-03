/**
 * Background scheduling — one owner for the two "don't block the frame"
 * primitives this app keeps re-deriving inline.
 *
 * `yieldToScheduler()` breaks a long synchronous loop into separate tasks so no
 * single task overruns the frame budget. `runAtBackgroundPriority()` defers work
 * that has no deadline (prefetch, warm-up) behind whatever the user can see.
 *
 * Both are progressive: `scheduler.yield()` / `scheduler.postTask()` are
 * Chromium-only and explicitly NOT Baseline (verified against MDN 2026-09-03),
 * so each falls back through `requestIdleCallback` (also not universal) to a
 * plain macrotask. Both APIs exist inside Web Workers as well as on the window,
 * so this module reads `globalThis` rather than `window` and is safe to import
 * from worker and SSR contexts.
 */

type SchedulerLike = {
  postTask?: (
    callback: () => void,
    options?: { priority?: "user-blocking" | "user-visible" | "background" }
  ) => Promise<unknown>;
  yield?: () => Promise<void>;
};

type IdleCapableGlobal = {
  scheduler?: SchedulerLike;
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number }
  ) => number;
};

function schedulerApi(): SchedulerLike | undefined {
  return (globalThis as IdleCapableGlobal).scheduler;
}

/**
 * Hand the thread back so the browser can paint a frame or service input, then
 * resume. Call this BETWEEN units of work in a loop, never inside the unit —
 * yielding cannot subdivide one long synchronous computation.
 *
 * `scheduler.yield()` resumes ahead of already-queued tasks, so a chunked loop
 * keeps its place in line instead of losing it to every other pending timer the
 * way a `setTimeout(0)` chain does. Where it is missing, the macrotask fallback
 * is slower to resume but still unblocks the frame, which is the point.
 */
export async function yieldToScheduler(): Promise<void> {
  const scheduler = schedulerApi();
  if (typeof scheduler?.yield === "function") {
    try {
      await scheduler.yield();
      return;
    } catch {
      // An aborted yield rejects with the signal's reason. Nothing here owns a
      // signal, so treat it as "could not yield that way" and fall through.
    }
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Run `task` once the thread has room, behind anything the user can perceive.
 *
 * `timeout` bounds the wait for the `requestIdleCallback` fallback: a page with
 * a continuously running animation loop may never report a genuine idle period,
 * and work that never runs is worse than work that runs late. The
 * `scheduler.postTask` path needs no timeout — "background" priority is ordered
 * behind other work rather than gated on idleness, so it always drains.
 */
export function runAtBackgroundPriority(
  task: () => void,
  options?: { timeout?: number }
): void {
  const scheduler = schedulerApi();
  if (typeof scheduler?.postTask === "function") {
    void scheduler.postTask(task, { priority: "background" })?.catch(() => {
      // postTask rejects when the task's signal aborts. Nothing here aborts,
      // but an unhandled rejection would still surface in the console.
    });
    return;
  }

  const requestIdle = (globalThis as IdleCapableGlobal).requestIdleCallback;
  if (typeof requestIdle === "function") {
    requestIdle(task, { timeout: options?.timeout ?? 2000 });
    return;
  }

  setTimeout(task, 0);
}
