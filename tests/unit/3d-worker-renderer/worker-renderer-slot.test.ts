import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerRendererSlot } from "$lib/shared/3d/worker-renderer/services/worker-renderer-slot";

class FakeWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

describe("worker renderer slot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function fixture() {
    const worker = new FakeWorker();
    const canvas = {
      className: "",
      style: {} as CSSStyleDeclaration,
      setAttribute: vi.fn(),
      transferControlToOffscreen: vi.fn(() => ({ width: 1, height: 1 })),
      remove: vi.fn(),
    } as unknown as HTMLCanvasElement;
    vi.mocked(document.createElement).mockReturnValueOnce(canvas);
    const container = {
      append: vi.fn(),
    } as unknown as HTMLElement;
    const onDestroyed = vi.fn();
    const onMessage = vi.fn();
    const slot = new WorkerRendererSlot({
      container,
      state: {
        id: "a",
        requestId: 7,
        environment: "rainbow",
        status: "booting",
      },
      viewport: { width: 640, height: 360, dpr: 1 },
      camera: { position: [0, 2, 8], target: [0, 0, 0], fov: 45 },
      createWorker: () => worker as unknown as Worker,
      onMessage,
      onError: vi.fn(),
      onDestroyed,
    });
    return { worker, canvas, container, onDestroyed, onMessage, slot };
  }

  it("transfers a fresh canvas and sends exactly one initialize message", () => {
    const { worker, canvas, container } = fixture();

    expect(container.append).toHaveBeenCalledWith(canvas);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage.mock.calls[0]?.[0]).toMatchObject({
      type: "initialize",
      requestId: 7,
      environment: "rainbow",
    });
    expect(worker.postMessage.mock.calls[0]?.[1]).toHaveLength(1);
  });

  it("includes the resolved effect frame in the worker initialization", () => {
    const worker = new FakeWorker();
    const canvas = {
      className: "",
      style: {} as CSSStyleDeclaration,
      setAttribute: vi.fn(),
      transferControlToOffscreen: vi.fn(() => ({ width: 1, height: 1 })),
      remove: vi.fn(),
    } as unknown as HTMLCanvasElement;
    vi.mocked(document.createElement).mockReturnValueOnce(canvas);
    const effects = { playing: true, sources: [] } as const;

    new WorkerRendererSlot({
      container: { append: vi.fn() } as unknown as HTMLElement,
      state: {
        id: "effects",
        requestId: 8,
        environment: "ocean",
        status: "booting",
      },
      viewport: { width: 640, height: 360, dpr: 1 },
      camera: { position: [0, 2, 8], target: [0, 0, 0], fov: 45 },
      effects,
      createWorker: () => worker as unknown as Worker,
      onMessage: vi.fn(),
      onError: vi.fn(),
      onDestroyed: vi.fn(),
    });

    expect(worker.postMessage.mock.calls[0]?.[0]).toMatchObject({ effects });
  });

  it("destroys once when the worker acknowledges disposal", () => {
    const { worker, canvas, onDestroyed, slot } = fixture();
    const after = vi.fn();

    slot.destroy(after);
    worker.onmessage?.(
      new MessageEvent("message", {
        data: { type: "disposed", requestId: 7 },
      })
    );
    vi.advanceTimersByTime(200);

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(canvas.remove).toHaveBeenCalledTimes(1);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("force-terminates a worker that does not acknowledge disposal", () => {
    const { worker, onDestroyed, slot } = fixture();
    const after = vi.fn();

    slot.destroy(after);
    vi.advanceTimersByTime(100);

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("terminates a superseded staging worker synchronously", () => {
    const { worker, canvas, onDestroyed, slot } = fixture();
    const after = vi.fn();

    slot.terminate(after);

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(canvas.remove).toHaveBeenCalledTimes(1);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });
});
