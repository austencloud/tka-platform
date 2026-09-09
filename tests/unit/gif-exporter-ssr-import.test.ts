import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("GIF exporter SSR compatibility", () => {
  it("loads through native ESM without requiring browser globals", () => {
    const exporterUrl = new URL(
      "../../src/lib/shared/animation-engine/services/live-canvas-gif-exporter.ts",
      import.meta.url
    ).href;
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `const exporter = await import(${JSON.stringify(exporterUrl)}); console.log(typeof exporter.exportLiveCanvasAsGif);`,
      ],
      { encoding: "utf8" }
    );
    expect(output.trim()).toBe("function");
  });
});
