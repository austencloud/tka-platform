import { describe, it, expect } from "vitest";
import type { FrontJob } from "$lib/shared/render/services/front-job";

describe("FrontJob", () => {
  it("is structuredClone-able (plain data only)", () => {
    const job: FrontJob = {
      canvasWidth: 728, canvasHeight: 1028,
      layout: { columns: 2, rows: 2, stepSize: 300, canvasWidth: 728, canvasHeight: 1028, headerHeight: 80, footerHeight: 60, gridOffsetX: 0, gridOffsetY: 80, isDarkMode: false, derivedWord: "AB", startColumn: 1, startRow: 0, stepsPerRow: 1, hasStartPosition: true } as any,
      cells: [], cellOptions: { size: 300 } as any, cellVisibility: { showTKA: true, showReversals: true } as any,
      background: { fill: "#fff" }, isDarkMode: false,
      mandala: null, qr: null,
      header: { show: true, word: "AB" },
      footer: { show: false, textColor: "#111", mutedColor: "#555" },
    };
    expect(() => structuredClone(job)).not.toThrow();
  });
});
