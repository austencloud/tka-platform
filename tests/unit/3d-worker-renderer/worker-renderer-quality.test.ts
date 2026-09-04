// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WorkerEnvironmentRenderer } from "$lib/shared/3d/worker-renderer/services/worker-environment-renderer";

class FakeWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

function fakeCanvas(): HTMLCanvasElement {
  return {
    className: "",
    style: {} as CSSStyleDeclaration,
    setAttribute: vi.fn(),
    transferControlToOffscreen: vi.fn(() => ({ width: 1, height: 1 })),
    remove: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

describe("worker renderer adaptive quality", () => {
  beforeEach(() => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.spyOn(document, "createElement");
    Object.defineProperty(
      window.HTMLCanvasElement.prototype,
      "transferControlToOffscreen",
      {
        configurable: true,
        value: vi.fn(),
      }
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      }
    );
  });

  afterEach(() => {
    delete (
      window.HTMLCanvasElement.prototype as HTMLCanvasElement & {
        transferControlToOffscreen?: unknown;
      }
    ).transferControlToOffscreen;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("updates live slots and retains the tier for the next slot", () => {
    const workers: FakeWorker[] = [];
    vi.mocked(document.createElement)
      .mockReturnValueOnce(fakeCanvas())
      .mockReturnValueOnce(fakeCanvas());
    const container = {
      append: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        width: 640,
        height: 360,
      })),
    } as unknown as HTMLElement;
    const renderer = new WorkerEnvironmentRenderer({
      container,
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
    });
    expect(renderer.snapshot.supported).toBe(true);

    renderer.switchTo("ocean");
    expect(workers[0]?.postMessage.mock.calls[0]?.[0]).toMatchObject({
      type: "initialize",
      qualityTier: "medium",
    });

    renderer.setQualityTier("low");
    expect(workers[0]?.postMessage).toHaveBeenLastCalledWith({
      type: "quality",
      requestId: 1,
      qualityTier: "low",
    });

    renderer.switchTo("rainbow");
    expect(workers[1]?.postMessage.mock.calls[0]?.[0]).toMatchObject({
      type: "initialize",
      environment: "rainbow",
      qualityTier: "low",
    });

    renderer.dispose();
  });

  it("reports frame cadence from only the active worker", () => {
    const workers: FakeWorker[] = [];
    vi.mocked(document.createElement)
      .mockReturnValueOnce(fakeCanvas())
      .mockReturnValueOnce(fakeCanvas());
    const onFrame = vi.fn();
    const renderer = new WorkerEnvironmentRenderer({
      container: {
        append: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getBoundingClientRect: vi.fn(() => ({ width: 640, height: 360 })),
      } as unknown as HTMLElement,
      onFrame,
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
    });

    renderer.switchTo("ocean");
    workers[0]?.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "first-frame",
          requestId: 1,
          environment: "ocean",
          metrics: {},
        },
      })
    );
    workers[0]?.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "frame",
          requestId: 1,
          environment: "ocean",
          frame: 2,
          renderedAt: 100,
          deltaMs: 24,
        },
      })
    );

    renderer.switchTo("rainbow");
    workers[1]?.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "frame",
          requestId: 2,
          environment: "rainbow",
          frame: 1,
          renderedAt: 120,
          deltaMs: 99,
        },
      })
    );

    expect(onFrame).toHaveBeenCalledOnce();
    expect(onFrame).toHaveBeenCalledWith(24);
    renderer.dispose();
  });

  it("keeps the worker's authored Ocean defaults while applying tier gates", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/lib/shared/3d/worker-renderer/workers/environment-renderer.worker.ts"
      ),
      "utf8"
    );

    expect(source).toContain("enabled: quality.composerEnabled");
    expect(source).toContain("tierBloom: quality.tierBloom");
    expect(source).toContain("enableShadows: quality.enableShadows");
    expect(source).toContain(
      "tierBloomResolutionScale: quality.bloomResolutionScale"
    );
    expect(source).toContain("tierBloomLevels: quality.bloomLevels");
    expect(source).toContain("oceanBloom: true");
    expect(source).toContain("oceanWaterTint: true");
    expect(source).toContain("oceanWaterTintStrength: 0.8");
    expect(source).toContain("oceanUnderwaterDistortion: false");
    expect(source).toContain('case "quality":');
  });
});
