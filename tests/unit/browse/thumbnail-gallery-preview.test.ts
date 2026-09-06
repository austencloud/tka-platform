import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  deriveKey,
  type ThumbnailRenderInput,
} from "$lib/shared/browse/services/thumbnail-key-deriver";
import { ThumbnailRenderOrchestrator } from "$lib/shared/browse/services/thumbnail-render-orchestrator";
import { ThumbnailRenderQueue } from "$lib/shared/browse/services/thumbnail-render-queue";
import { ThumbnailMetricsCollector } from "$lib/shared/browse/services/thumbnail-metrics-collector";

vi.mock("$lib/shared/analytics/thumbnail-analytics", () => ({
  captureThumbnailRenderFailure: vi.fn(),
}));
vi.mock("$lib/shared/browse/services/cloud-thumbnail-cache", () => ({
  getCachedUrl: () => null,
  getUrl: vi.fn(async () => null),
  upload: vi.fn(async () => null),
}));

const input: ThumbnailRenderInput = {
  sequenceName: "BJEA",
  sequenceId: "BJEA",
  variant: "gallery",
  leftPropType: PropType.STAFF,
  rightPropType: PropType.STAFF,
  catDogModeEnabled: false,
  lightMode: false,
  visibility: { showQRCode: true, showMandala: true },
};
const sequence = {
  id: "BJEA",
  word: "BJEA",
  steps: [],
} as unknown as SequenceData;

function harness() {
  const local = new Map<string, Blob>();
  const cache = {
    get: vi.fn(async (hash: string) => local.get(hash) ?? null),
    set: vi.fn(async (hash: string, blob: Blob) => {
      local.set(hash, blob);
    }),
  };
  const render = vi.fn(
    async (_sequence: SequenceData, options: ThumbnailRenderInput) => {
      // Reproduce a QR preparation that never finishes. Preview drawing is cheap.
      if (options.visibility?.showQRCode) return new Promise<never>(() => {});
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { blob: new Blob(["card"]), qrConsistent: true };
    }
  );
  const queue = new ThumbnailRenderQueue();
  const metrics = new ThumbnailMetricsCollector();
  const orchestrator = new ThumbnailRenderOrchestrator(
    queue,
    { render } as never,
    cache as never,
    metrics
  );
  return { local, cache, render, queue, metrics, orchestrator };
}

beforeEach(() => {
  vi.useFakeTimers();
  let next = 0;
  vi.stubGlobal("URL", {
    createObjectURL: () => `blob:preview-${next++}`,
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => [] }))
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("gallery previews under a cold QR backlog", () => {
  it("finishes a large batch without starting QR work or poisoning QR keys", async () => {
    const h = harness();
    const requests = Array.from({ length: 24 }, (_, index) => {
      const id = `card-${index}`;
      return h.orchestrator.getThumbnail({
        sequence: { ...sequence, id },
        input: { ...input, sequenceId: id, sequenceName: id },
        skipCache: true,
        qrPolicy: "cache-only",
      });
    });
    await vi.advanceTimersByTimeAsync(200);
    const results = await Promise.all(requests);
    expect(results.every((result) => result.url && !result.error)).toBe(true);
    expect(h.queue.getStats()).toMatchObject({ active: 0, queued: 0 });
    expect(h.render).toHaveBeenCalledTimes(24);
    expect(h.metrics.getSummary()).toMatchObject({
      totalRequests: 24,
      cancelRate: 0,
      renderFailureRate: 0,
    });
    for (const result of results) {
      expect(result.key.inputs.visibility?.showQRCode).toBe(false);
      expect(h.local.has(result.key.hash)).toBe(true);
      const qrKey = deriveKey({
        ...result.key.inputs,
        visibility: { ...result.key.inputs.visibility, showQRCode: true },
      });
      expect(h.local.has(qrKey.hash)).toBe(false);
      expect(h.orchestrator.getCached(qrKey.hash)).toBeNull();
    }
  });

  it("reuses a cached QR image without replacing it with a preview", async () => {
    const h = harness();
    const key = deriveKey(input);
    h.local.set(key.hash, new Blob(["scannable QR card"]));
    const result = await h.orchestrator.getThumbnail({
      sequence,
      input,
      qrPolicy: "cache-only",
    });
    expect(result).toMatchObject({ fromCache: true, key: { hash: key.hash } });
    expect(h.render).not.toHaveBeenCalled();
  });

  it("shares a preview's cache with no-QR callers on later visits", async () => {
    const h = harness();
    const request = h.orchestrator.getThumbnail({
      sequence,
      input,
      qrPolicy: "cache-only",
      skipCache: true,
    });
    await vi.advanceTimersByTimeAsync(25);
    const preview = await request;
    const revisit = await h.orchestrator.getThumbnail({
      sequence,
      input,
      qrPolicy: "cache-only",
    });
    expect(revisit.url).toBe(preview.url);
    expect(revisit.fromCache).toBe(true);
    expect(h.render).toHaveBeenCalledOnce();
  });

  it("keeps the full QR path for warmers and explicit card renders", async () => {
    const h = harness();
    h.render.mockResolvedValue({ blob: new Blob(["QR"]), qrConsistent: true });
    const result = await h.orchestrator.getThumbnail({
      sequence,
      input,
      skipCache: true,
    });
    expect(result.key.inputs.visibility?.showQRCode).toBe(true);
    expect(h.local.has(deriveKey(input).hash)).toBe(true);
    expect(h.render).toHaveBeenCalledWith(
      sequence,
      expect.objectContaining({
        visibility: expect.objectContaining({ showQRCode: true }),
      }),
      undefined,
      expect.any(Function),
      expect.any(AbortSignal),
      expect.any(Function),
      expect.any(Function)
    );
  });
});
