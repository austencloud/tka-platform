import { describe, it, expect, beforeEach, vi } from "vitest";

// Mocks must be declared before importing the SUT.
const blobGet = vi.fn();
const blobSet = vi.fn().mockResolvedValue(undefined);
vi.mock("$lib/shared/render/services/pictograph-blob-cache", () => ({
  pictographBlobCache: { get: (...a: unknown[]) => blobGet(...a), set: (...a: unknown[]) => blobSet(...a) },
}));

const poolRender = vi.fn();
vi.mock("$lib/shared/render/services/worker-render-pool", () => ({
  getWorkerRenderPool: () => ({ render: (...a: unknown[]) => poolRender(...a) }),
}));

const cloudDownload = vi.fn();
const cloudUpload = vi.fn().mockResolvedValue("https://x/y.webp");
vi.mock("$lib/shared/render/services/pictograph-cloud-cache", () => ({
  download: (...a: unknown[]) => cloudDownload(...a),
  upload: (...a: unknown[]) => cloudUpload(...a),
  cellPublicUrl: (h: string) => `https://x/${h}.webp`,
}));

vi.mock("$lib/shared/render/services/cloud-cell-key", () => ({
  CANONICAL_CELL_SIZE: 480,
  deriveCloudCellHash: vi.fn().mockResolvedValue("HASH"),
  canonicalCellKeyString: vi.fn().mockReturnValue("k"),
}));

vi.mock("$lib/shared/pictograph/shared/services/pictograph-preparer", () => ({
  pictographPreparer: { prepareSingle: vi.fn().mockResolvedValue({}) },
}));
vi.mock("$lib/shared/render/services/png-blob-to-webp", () => ({
  pngBlobToWebp: vi.fn().mockResolvedValue(new Blob(["w"], { type: "image/webp" })),
}));

globalThis.URL.createObjectURL = vi.fn(() => "blob:fake");

import { renderCell } from "./preview-cell-renderer";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const data = { letter: "A", motions: {} } as unknown as PictographData;
const opts = { size: 300 };

describe("renderCell cloud tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    blobGet.mockResolvedValue(null); // IndexedDB miss (cold scanner)
  });

  it("cloud HIT: downloads, never calls the worker", async () => {
    cloudDownload.mockResolvedValue(new Blob(["img"], { type: "image/webp" }));

    await renderCell(data, undefined, true, opts);

    expect(cloudDownload).toHaveBeenCalledWith("HASH");
    expect(poolRender).not.toHaveBeenCalled();
  });

  it("cloud MISS: renders via worker AND uploads the result", async () => {
    cloudDownload.mockResolvedValue(null); // direct-probe miss
    poolRender.mockResolvedValue(new Blob(["png"], { type: "image/png" }));

    await renderCell(data, undefined, true, opts);

    expect(poolRender).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(cloudUpload).toHaveBeenCalledWith("HASH", expect.any(Blob));
  });
});
