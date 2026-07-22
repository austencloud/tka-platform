import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/shared/navigation/services/sequence-hydrator", () => ({
  hydrateSequence: vi.fn(async (sequence) => sequence),
}));

vi.mock("$lib/shared/qr/services/scan-prop-resolver", () => ({
  resolveScanPropConfig: vi.fn(() => ({
    bluePropType: "poi",
    redPropType: "fan",
    catDogMode: true,
  })),
}));

import { listAllShortCodes, startScanCellWarm } from "./warm-all-scan-cells";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const sequence = {
  id: "sequence-1",
  word: "AB",
  steps: [{ letter: "A", motions: {} }],
} as unknown as SequenceData;

describe("shortcode scan-cell backfill", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists Firestore document names without transferring shortcode payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          document: {
            name: "projects/tka/databases/(default)/documents/shortcodes/0017",
          },
        },
        { readTime: "2026-07-21T00:00:00Z" },
        {
          document: {
            name: "projects/tka/databases/(default)/documents/shortcodes/ABCD",
          },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAllShortCodes()).resolves.toEqual(["0017", "ABCD"]);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(request.method).toBe("POST");
    expect(body.structuredQuery.select).toEqual({
      fields: [{ fieldPath: "__name__" }],
    });
  });

  it("warms every QR record with exact props in both themes", async () => {
    const warmCells = vi.fn().mockResolvedValue({
      total: 2,
      ready: 2,
      hashes: [],
      failures: [],
    });
    const progress = vi.fn();

    const result = await startScanCellWarm(progress, {
      listCodes: async () => ["A001", "A002"],
      resolveCode: async () => ({
        sequence,
        record: { bluePropType: "poi" } as never,
      }),
      warmCells,
      concurrency: 1,
    }).promise;

    expect(result).toMatchObject({
      done: 2,
      total: 2,
      failed: 0,
      finished: true,
    });
    expect(warmCells).toHaveBeenCalledTimes(4);
    expect(warmCells).toHaveBeenNthCalledWith(
      1,
      sequence,
      expect.objectContaining({
        isDark: true,
        bluePropType: "poi",
        redPropType: "fan",
        catDogMode: true,
        requireComplete: true,
      })
    );
    expect(warmCells).toHaveBeenNthCalledWith(
      2,
      sequence,
      expect.objectContaining({ isDark: false, requireComplete: true })
    );
  });

  it("counts an unresolved shortcode instead of silently dropping it", async () => {
    const result = await startScanCellWarm(vi.fn(), {
      listCodes: async () => ["BROKEN"],
      resolveCode: async () => ({ sequence: null, record: null }),
      warmCells: vi.fn(),
    }).promise;

    expect(result).toMatchObject({
      done: 1,
      total: 1,
      failed: 1,
      failedCodes: ["BROKEN"],
    });
  });
});
