import { beforeEach, describe, expect, it, vi } from "vitest";

const renderCell = vi.fn().mockResolvedValue("blob:fake");
vi.mock("$lib/shared/sequence-viewer/services/preview-cell-renderer", () => ({
  renderCell: (...args: unknown[]) => renderCell(...args),
}));

const deriveCloudCellHash = vi.fn(
  async (data: { letter?: string }) => `hash-${data.letter ?? "cell"}`
);
vi.mock("$lib/shared/render/services/cloud-cell-key", () => ({
  CANONICAL_CELL_SIZE: 480,
  CANONICAL_CARD_VISIBILITY: { showTKA: true },
  deriveCloudCellHash: (...args: unknown[]) =>
    deriveCloudCellHash(args[0] as { letter?: string }),
}));

const cloudDownload = vi
  .fn()
  .mockResolvedValue(new Blob(["ready"], { type: "image/webp" }));
vi.mock("$lib/shared/render/services/pictograph-cloud-cache", () => ({
  download: (...args: unknown[]) => cloudDownload(...args),
}));

vi.mock(
  "$lib/shared/pictograph/shared/services/start-position-deriver",
  () => ({
    startPositionDeriver: {
      getOrDeriveStartPosition: (sequence: { startPosition?: unknown }) =>
        sequence.startPosition ?? null,
    },
  })
);

globalThis.URL.revokeObjectURL = vi.fn();

import {
  _resetWarmStateForTest,
  IncompleteCellWarmError,
  warmSequenceCells,
} from "./warm-sequence-cells";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const sequence = {
  id: "s1",
  steps: [
    { letter: "A", motions: {} },
    { letter: "B", motions: {} },
  ],
  startPosition: { letter: "alpha", motions: {} },
} as unknown as SequenceData;

describe("warmSequenceCells", () => {
  beforeEach(() => {
    _resetWarmStateForTest();
    vi.clearAllMocks();
    renderCell.mockResolvedValue("blob:fake");
    cloudDownload.mockResolvedValue(
      new Blob(["ready"], { type: "image/webp" })
    );
  });

  it("verifies start and every step under the exact canonical prop pair", async () => {
    const readsByHash = new Map<string, number>();
    cloudDownload.mockImplementation(async (hash: string) => {
      const reads = (readsByHash.get(hash) ?? 0) + 1;
      readsByHash.set(hash, reads);
      return reads === 1 ? null : new Blob(["ready"], { type: "image/webp" });
    });

    const result = await warmSequenceCells(sequence, {
      isDark: true,
      bluePropType: PropType.POI,
      redPropType: PropType.FAN,
      catDogMode: true,
      requireComplete: true,
    });

    expect(result).toMatchObject({ total: 3, ready: 3, failures: [] });
    expect(renderCell).toHaveBeenCalledTimes(3);
    expect(cloudDownload).toHaveBeenCalledTimes(6);
    const options = renderCell.mock.calls[0]![3] as {
      size: number;
      bluePropType: PropType;
      redPropType: PropType;
      catDogModeEnabled: boolean;
      uploadCanonical: boolean;
    };
    expect(options).toMatchObject({
      size: 480,
      bluePropType: PropType.POI,
      redPropType: PropType.FAN,
      catDogModeEnabled: true,
      uploadCanonical: true,
    });
  });

  it("accepts an existing canonical object without rendering or reading it twice", async () => {
    const result = await warmSequenceCells(sequence, {
      requireComplete: true,
    });

    expect(result).toMatchObject({ total: 3, ready: 3, failures: [] });
    expect(cloudDownload).toHaveBeenCalledTimes(3);
    expect(renderCell).not.toHaveBeenCalled();
  });

  it("reports individual failures in best-effort mode", async () => {
    renderCell.mockRejectedValueOnce(new Error("boom"));
    const result = await warmSequenceCells(sequence);
    expect(result.total).toBe(3);
    expect(result.ready).toBe(2);
    expect(result.failures).toEqual([{ cell: "start", reason: "boom" }]);
  });

  it("refuses strict completion when an uploaded object cannot be read back", async () => {
    cloudDownload.mockResolvedValue(null);
    await expect(
      warmSequenceCells(sequence, { requireComplete: true })
    ).rejects.toBeInstanceOf(IncompleteCellWarmError);
  });

  it("renders each verified hash once across concurrent sequences and later calls", async () => {
    const readsByHash = new Map<string, number>();
    cloudDownload.mockImplementation(async (hash: string) => {
      const reads = (readsByHash.get(hash) ?? 0) + 1;
      readsByHash.set(hash, reads);
      return reads === 1 ? null : new Blob(["ready"], { type: "image/webp" });
    });

    await Promise.all([
      warmSequenceCells(sequence, { requireComplete: true }),
      warmSequenceCells(sequence, { requireComplete: true }),
    ]);

    expect(renderCell).toHaveBeenCalledTimes(3);
    expect(cloudDownload).toHaveBeenCalledTimes(6);

    await warmSequenceCells(sequence, { requireComplete: true });

    expect(renderCell).toHaveBeenCalledTimes(3);
    expect(cloudDownload).toHaveBeenCalledTimes(6);
  });

  it("retries a hash after strict verification fails", async () => {
    const readsByHash = new Map<string, number>();
    let failedHashReadable = false;
    cloudDownload.mockImplementation(async (hash: string) => {
      const reads = (readsByHash.get(hash) ?? 0) + 1;
      readsByHash.set(hash, reads);
      if (reads === 1) return null;
      if (hash === "hash-alpha" && !failedHashReadable) return null;
      return new Blob(["ready"], { type: "image/webp" });
    });

    await expect(
      warmSequenceCells(sequence, { requireComplete: true })
    ).rejects.toBeInstanceOf(IncompleteCellWarmError);

    failedHashReadable = true;
    await warmSequenceCells(sequence, { requireComplete: true });

    // The two hashes that verified successfully remain reusable; only the
    // failed hash is probed again after its transient read-back failure.
    expect(renderCell).toHaveBeenCalledTimes(3);
    expect(cloudDownload).toHaveBeenCalledTimes(7);
  });
});
