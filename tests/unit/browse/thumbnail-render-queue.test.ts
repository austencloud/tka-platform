import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ThumbnailRenderQueue,
  ThumbnailRenderTimeoutError,
} from "$lib/shared/browse/services/thumbnail-render-queue";

describe("ThumbnailRenderQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets a caller handle a render failure without leaking an unhandled rejection", async () => {
    const queue = new ThumbnailRenderQueue();
    const failure = new Error("render failed");

    await expect(
      queue.enqueue("failed-thumbnail", async () => {
        throw failure;
      })
    ).rejects.toBe(failure);

    // Promise rejection notifications run after the current microtask turn.
    // Vitest fails the suite if the queue leaks a rejected child promise.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });

  it("reports the typed deadline when abort-aware work rejects synchronously", async () => {
    vi.useFakeTimers();
    const queue = new ThumbnailRenderQueue();
    let renderSignal: AbortSignal | null = null;
    const render = queue.enqueue("timed-out-thumbnail", (signal) => {
      renderSignal = signal;
      return new Promise<never>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true }
        );
      });
    });
    const handledRejection = render.catch((error) => error);

    await vi.advanceTimersByTimeAsync(15_000);
    const error = await handledRejection;

    expect(renderSignal?.aborted).toBe(true);
    expect(error).toBeInstanceOf(ThumbnailRenderTimeoutError);
    expect(error).toMatchObject({
      code: "THUMBNAIL_RENDER_TIMEOUT",
      timeoutMs: 15_000,
      message: "Thumbnail render exceeded 15000ms",
    });
  });

  it("clears the deadline when rendering succeeds", async () => {
    vi.useFakeTimers();
    const queue = new ThumbnailRenderQueue();

    await expect(
      queue.enqueue("successful-thumbnail", async () => "rendered")
    ).resolves.toBe("rendered");

    expect(vi.getTimerCount()).toBe(0);
  });

  it("reclaims a timed-out queue slot exactly once", async () => {
    vi.useFakeTimers();
    const queue = new ThumbnailRenderQueue();
    queue.setMaxConcurrent(1);
    let secondRuns = 0;

    const first = queue
      .enqueue("hung-thumbnail", () => new Promise<never>(() => {}))
      .catch((error) => error);
    const second = queue.enqueue("next-thumbnail", async () => {
      secondRuns++;
      return "rendered";
    });

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(first).resolves.toBeInstanceOf(ThumbnailRenderTimeoutError);
    await expect(second).resolves.toBe("rendered");
    expect(secondRuns).toBe(1);
    expect(queue.getStats()).toMatchObject({ active: 0, queued: 0 });
  });

  it("keeps explicit cancellation distinct from a timeout", async () => {
    const queue = new ThumbnailRenderQueue();
    queue.setMaxConcurrent(1);
    const render = queue.enqueue(
      "cancelled-thumbnail",
      (signal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true }
          );
        })
    );
    const handledRejection = render.catch((error) => error);
    const queuedRender = queue.enqueue(
      "queued-cancelled-thumbnail",
      async () => "should not render"
    );
    const handledQueuedRejection = queuedRender.catch((error) => error);

    queue.cancelAll();

    const [activeError, queuedError] = await Promise.all([
      handledRejection,
      handledQueuedRejection,
    ]);
    expect(activeError).toMatchObject({ name: "AbortError" });
    expect(queuedError).toMatchObject({ name: "AbortError" });
    expect(activeError).not.toBeInstanceOf(ThumbnailRenderTimeoutError);
    expect(queue.getStats()).toMatchObject({ active: 0, queued: 0 });
  });

  it("rejects queued cancellation and allows an immediate retry of the same ID", async () => {
    const queue = new ThumbnailRenderQueue();
    queue.setMaxConcurrent(1);
    let finishActive!: () => void;

    const active = queue.enqueue(
      "active-thumbnail",
      () =>
        new Promise<string>((resolve) => {
          finishActive = () => resolve("active rendered");
        })
    );
    const queued = queue.enqueue(
      "queued-thumbnail",
      async () => "stale render"
    );
    const handledCancellation = queued.catch((error) => error);

    expect(queue.getStats()).toMatchObject({ active: 1, queued: 1 });
    queue.cancel("queued-thumbnail");
    const retry = queue.enqueue(
      "queued-thumbnail",
      async () => "retry rendered"
    );

    await expect(handledCancellation).resolves.toMatchObject({
      name: "AbortError",
      message: "Cancelled",
    });
    expect(queue.getStats()).toMatchObject({ active: 1, queued: 1 });

    finishActive();
    await expect(active).resolves.toBe("active rendered");
    await expect(retry).resolves.toBe("retry rendered");
    expect(queue.getStats()).toMatchObject({ active: 0, queued: 0 });
  });

  it("aborts active work when its ID is cancelled", async () => {
    const queue = new ThumbnailRenderQueue();
    let renderSignal: AbortSignal | null = null;
    const render = queue.enqueue("active-thumbnail", (signal) => {
      renderSignal = signal;
      return new Promise<never>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true }
        );
      });
    });
    const handledRejection = render.catch((error) => error);

    queue.cancel("active-thumbnail");

    await expect(handledRejection).resolves.toMatchObject({
      name: "AbortError",
    });
    expect(renderSignal?.aborted).toBe(true);
    expect(queue.getStats()).toMatchObject({ active: 0, queued: 0 });
  });

  it("keeps shared work alive when only one deduplicated consumer aborts", async () => {
    const queue = new ThumbnailRenderQueue();
    const firstConsumer = new AbortController();
    const secondConsumer = new AbortController();
    let finishRender!: () => void;
    let coreSignal: AbortSignal | null = null;
    let renderCount = 0;
    const execute = (signal: AbortSignal) => {
      renderCount++;
      coreSignal = signal;
      return new Promise<string>((resolve) => {
        finishRender = () => resolve("rendered");
      });
    };

    const first = queue.enqueue(
      "shared-thumbnail",
      execute,
      Infinity,
      firstConsumer.signal
    );
    const firstHandled = first.catch((error) => error);
    const second = queue.enqueue(
      "shared-thumbnail",
      execute,
      Infinity,
      secondConsumer.signal
    );

    firstConsumer.abort();

    await expect(firstHandled).resolves.toMatchObject({
      name: "AbortError",
    });
    expect(renderCount).toBe(1);
    expect(coreSignal?.aborted).toBe(false);
    expect(queue.getStats()).toMatchObject({ active: 1, queued: 0 });

    finishRender();
    await expect(second).resolves.toBe("rendered");
    expect(queue.getStats()).toMatchObject({ active: 0, queued: 0 });
  });

  it("forgets a failed request so the same thumbnail can be retried", async () => {
    const queue = new ThumbnailRenderQueue();

    await expect(
      queue.enqueue("retryable-thumbnail", async () => {
        throw new Error("first render failed");
      })
    ).rejects.toThrow("first render failed");

    await expect(
      queue.enqueue("retryable-thumbnail", async () => "rendered")
    ).resolves.toBe("rendered");
  });
});
