import { describe, it, expect } from "vitest";
import { CompositionDispatcher } from "../composition-dispatcher";

/**
 * Regression: a fully-failed worker pool used to hang forever.
 *
 * Production 2026-08-09: all 7 workers reported `Worker N init timeout` within
 * the same 40ms on /shop/loop-deck. Each failure was caught and logged, so the
 * pool was still marked initialized with every entry `ready: false`. pickWorker
 * seeded its "best" with workers[0] regardless of readiness, handed back a
 * worker that had never answered init, and the compose promise never settled —
 * so the main-thread fallback in compose() never got a chance to run.
 *
 * The pool must instead report that it has nothing ready.
 */
describe("composition dispatcher with a dead worker pool", () => {
  function dispatcherWithWorkers(
    workers: { ready: boolean; pendingCount: number }[],
  ): CompositionDispatcher {
    const d = new CompositionDispatcher({} as never, {} as never);
    (d as any).initialized = true;
    (d as any).ensureInitialized = async () => {};
    (d as any).workers = workers.map((w) => ({
      ...w,
      worker: { postMessage: () => {} },
    }));
    return d;
  }

  it("picks no worker when none finished init", () => {
    const d = dispatcherWithWorkers([
      { ready: false, pendingCount: 0 },
      { ready: false, pendingCount: 0 },
    ]);
    expect((d as any).pickWorker()).toBeNull();
  });

  it("skips a dead worker in favour of a ready one, even when the dead one looks idler", () => {
    const d = dispatcherWithWorkers([
      { ready: false, pendingCount: 0 },
      { ready: true, pendingCount: 3 },
    ]);
    expect((d as any).pickWorker()?.pendingCount).toBe(3);
  });

  it("still balances across ready workers", () => {
    const d = dispatcherWithWorkers([
      { ready: true, pendingCount: 2 },
      { ready: true, pendingCount: 1 },
      { ready: false, pendingCount: 0 },
    ]);
    expect((d as any).pickWorker()?.pendingCount).toBe(1);
  });

  it("rejects composeFrontBitmap instead of hanging, so callers fall back", async () => {
    const d = dispatcherWithWorkers([{ ready: false, pendingCount: 0 }]);
    await expect(
      d.composeFrontBitmap({ steps: [] } as never, {} as never),
    ).rejects.toThrow(/no composition worker is ready/i);
  });
});
