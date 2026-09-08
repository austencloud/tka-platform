import { describe, expect, it } from "vitest";

import { createWebGlGpuTimer } from "./webgl-gpu-timer";

describe("WebGL GPU timer", () => {
  it("returns an inert timer when the extension is unavailable", () => {
    const timer = createWebGlGpuTimer({
      getExtension: () => null,
    } as unknown as WebGLRenderingContext);

    expect(timer.supported).toBe(false);
    expect(timer.begin()).toBe(false);
    expect(timer.collect()).toEqual([]);
  });

  it("converts completed elapsed queries from nanoseconds to milliseconds", () => {
    const query = {} as WebGLQuery;
    const extension = {
      TIME_ELAPSED_EXT: 0x88bf,
      GPU_DISJOINT_EXT: 0x8fbb,
    };
    const context = {
      QUERY_RESULT_AVAILABLE: 0x8867,
      QUERY_RESULT: 0x8866,
      getExtension: () => extension,
      createQuery: () => query,
      beginQuery: () => undefined,
      endQuery: () => undefined,
      deleteQuery: () => undefined,
      getParameter: () => false,
      getQueryParameter: (_query: WebGLQuery, parameter: number) =>
        parameter === 0x8867 ? true : 11_500_000,
    } as unknown as WebGL2RenderingContext;
    const timer = createWebGlGpuTimer(context);

    expect(timer.begin()).toBe(true);
    timer.end();
    expect(timer.collect()).toEqual([11.5]);
  });
});
