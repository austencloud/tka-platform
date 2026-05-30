import { describe, it, expect } from "vitest";
import { CardFrontWorkerPool } from "$lib/shared/render/services/card-front-worker-pool";

describe("CardFrontWorkerPool", () => {
  it("rejects composeCell before seeding (not ready)", async () => {
    const pool = new CardFrontWorkerPool();
    await expect(
      pool.composeCell({} as any, { size: 300 } as any, { showTKA: true, showReversals: true }, 1),
    ).rejects.toThrow(/not ready/);
  });

  it("getCardFrontWorkerPool returns a singleton", async () => {
    const { getCardFrontWorkerPool } = await import("$lib/shared/render/services/card-front-worker-pool");
    expect(getCardFrontWorkerPool()).toBe(getCardFrontWorkerPool());
  });
});
