import { describe, expect, it } from "vitest";
import {
  clampWorkerViewport,
  isWorkerRendererOutMessage,
} from "$lib/shared/3d/worker-renderer/domain/worker-renderer-protocol";

describe("worker renderer protocol", () => {
  it("accepts only known worker messages with numeric request ids", () => {
    expect(isWorkerRendererOutMessage({ type: "frame", requestId: 4 })).toBe(
      true
    );
    expect(isWorkerRendererOutMessage({ type: "surprise", requestId: 4 })).toBe(
      false
    );
    expect(isWorkerRendererOutMessage({ type: "frame", requestId: "4" })).toBe(
      false
    );
    expect(isWorkerRendererOutMessage(null)).toBe(false);
  });

  it("keeps viewport dimensions valid and caps prototype DPR", () => {
    expect(clampWorkerViewport({ width: 0, height: -4, dpr: 8 })).toEqual({
      width: 1,
      height: 1,
      dpr: 2,
    });
    expect(
      clampWorkerViewport({ width: 100.4, height: 200.6, dpr: 0.25 })
    ).toEqual({ width: 100, height: 201, dpr: 0.5 });
  });
});
