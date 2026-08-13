import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPrintPDFCache,
  getOrBuildPrintPDF,
  type PreparedPrintPDF,
} from "../print-pdf-cache";

function artifact(label: string, printRunId: string | null): PreparedPrintPDF {
  return {
    blob: new NodeBlob([label], {
      type: "application/pdf",
    }) as unknown as Blob,
    printRunId,
  };
}

describe("prepared print PDF cache", () => {
  beforeEach(async () => {
    await clearPrintPDFCache();
  });

  afterEach(async () => {
    await clearPrintPDFCache();
  });

  it("reuses one prepared artifact for an identical key", async () => {
    let builds = 0;
    const build = async () => {
      builds++;
      return artifact("fronts", "run_fronts");
    };

    const first = await getOrBuildPrintPDF("deck-011-fronts", build);
    const second = await getOrBuildPrintPDF("deck-011-fronts", build);

    expect(builds).toBe(1);
    expect(second).toBe(first);
    expect(second.printRunId).toBe("run_fronts");
  });

  it("keeps changed settings on separate artifact keys", async () => {
    let builds = 0;
    const build = async () => artifact(`pdf-${++builds}`, `run_${builds}`);

    await getOrBuildPrintPDF("deck-011-fronts-copies-1", build);
    await getOrBuildPrintPDF("deck-011-fronts-copies-9", build);

    expect(builds).toBe(2);
  });

  it("shares an in-flight build instead of allocating two print runs", async () => {
    let builds = 0;
    const build = async () => {
      builds++;
      await Promise.resolve();
      return artifact("combined", "run_combined");
    };

    const [first, second] = await Promise.all([
      getOrBuildPrintPDF("deck-011-combined", build),
      getOrBuildPrintPDF("deck-011-combined", build),
    ]);

    expect(builds).toBe(1);
    expect(second).toBe(first);
  });

  it("does not retain a failed build", async () => {
    let builds = 0;

    await expect(
      getOrBuildPrintPDF("deck-011-retry", async () => {
        builds++;
        throw new Error("render failed");
      })
    ).rejects.toThrow("render failed");

    const retry = await getOrBuildPrintPDF("deck-011-retry", async () => {
      builds++;
      return artifact("retry", "run_retry");
    });

    expect(builds).toBe(2);
    expect(retry.printRunId).toBe("run_retry");
  });

  it("restores a prepared artifact after the module memory cache is replaced", async () => {
    await getOrBuildPrintPDF("deck-011-persisted", async () =>
      artifact("persisted", "run_persisted")
    );

    vi.resetModules();
    const reloaded = await import("../print-pdf-cache");
    let builds = 0;
    const restored = await reloaded.getOrBuildPrintPDF(
      "deck-011-persisted",
      async () => {
        builds++;
        return artifact("replacement", "run_replacement");
      }
    );

    expect(builds).toBe(0);
    expect(restored.printRunId).toBe("run_persisted");
    expect(restored.blob.size).toBeGreaterThan(0);
    await reloaded.clearPrintPDFCache();
  });
});
