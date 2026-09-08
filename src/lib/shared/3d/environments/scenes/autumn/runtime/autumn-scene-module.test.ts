import { describe, expect, it, vi } from "vitest";
import { loadAutumnSceneModule } from "./autumn-scene-module";

describe("Autumn dynamic scene module", () => {
  it("reports a rejected chunk and preserves the original failure", async () => {
    const error = new Error("chunk missing");
    const reportFailed = vi.fn();

    await expect(
      loadAutumnSceneModule(async () => {
        throw error;
      }, reportFailed)
    ).rejects.toBe(error);
    expect(reportFailed).toHaveBeenCalledWith(
      "Autumn scene couldn't load. Try again."
    );
  });
});
