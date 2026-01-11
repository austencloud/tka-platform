/**
 * Thumbnail Tier Selection Tests
 *
 * Ensures the 4-tier cache hierarchy is respected:
 * 1. Static bundled → 2. Local IndexedDB → 3. Cloud → 4. Render
 *
 * Critical: If tier selection is wrong, we silently fall through to
 * slower paths, degrading performance without obvious errors.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThumbnailRenderOrchestrator } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailRenderOrchestrator";
import type { IThumbnailKeyDeriver, ThumbnailCacheKey, ThumbnailRenderInput } from "$lib/features/discover/sequences/display/services/contracts/IThumbnailKeyDeriver";
import type { IThumbnailRenderQueue } from "$lib/features/discover/sequences/display/services/contracts/IThumbnailRenderQueue";
import type { IThumbnailRenderer } from "$lib/features/discover/sequences/display/services/contracts/IThumbnailRenderer";
import type { ICloudThumbnailCache } from "$lib/features/discover/sequences/display/services/contracts/ICloudThumbnailCache";
import type { IThumbnailLocalCache } from "$lib/features/discover/sequences/display/services/contracts/IThumbnailLocalCache";
import type { ThumbnailRequest } from "$lib/features/discover/sequences/display/services/contracts/IThumbnailRenderOrchestrator";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

// Mock implementations
function createMockKeyDeriver(overrides: Partial<ThumbnailCacheKey> = {}): IThumbnailKeyDeriver {
  const defaultKey: ThumbnailCacheKey = {
    hash: "test-hash-123",
    cloudPath: "thumbnails/gallery/staff/TestSeq_dark.webp",
    inputs: Object.freeze({
      sequenceName: "TestSeq",
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      lightMode: false,
      variant: "gallery",
      catDogModeEnabled: false,
    } as ThumbnailRenderInput),
    usesDefaults: true,
    propKey: PropType.STAFF,
    ...overrides,
  };

  return {
    deriveKey: vi.fn().mockReturnValue(defaultKey),
    keysEqual: vi.fn((a, b) => a.hash === b.hash),
    getVariantDefaults: vi.fn().mockReturnValue({}),
    inputUsesDefaults: vi.fn().mockReturnValue(true),
  };
}

function createMockRenderQueue(): IThumbnailRenderQueue {
  return {
    enqueue: vi.fn(async (_key, task) => task()),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
    getStats: vi.fn().mockReturnValue({ queued: 0, active: 0 }),
  };
}

function createMockRenderer(): IThumbnailRenderer {
  return {
    render: vi.fn().mockResolvedValue(new Blob(["test"], { type: "image/webp" })),
  };
}

function createMockCloudCache(cachedUrl: string | null = null): ICloudThumbnailCache {
  return {
    getCachedUrl: vi.fn().mockReturnValue(cachedUrl),
    getUrl: vi.fn().mockResolvedValue(cachedUrl),
    upload: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockLocalCache(cachedBlob: Blob | null = null): IThumbnailLocalCache {
  return {
    get: vi.fn().mockResolvedValue(cachedBlob),
    set: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(cachedBlob !== null),
    clear: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({ count: 0, sizeBytes: 0 }),
    prune: vi.fn().mockResolvedValue(0),
  };
}

function createTestRequest(): ThumbnailRequest {
  return {
    input: {
      sequenceName: "TestSeq",
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      lightMode: false,
      variant: "gallery",
      catDogModeEnabled: false,
    },
    sequence: { beats: [] } as any,
    priority: 1,
  };
}

describe("ThumbnailRenderOrchestrator Tier Selection", () => {
  // Note: Static manifest tests are harder because it uses module-level state
  // These tests focus on local cache and below

  describe("Tier 2: Local IndexedDB Cache", () => {
    it("returns immediately when local cache has blob", async () => {
      const cachedBlob = new Blob(["cached"], { type: "image/webp" });
      const localCache = createMockLocalCache(cachedBlob);
      const cloudCache = createMockCloudCache();
      const renderer = createMockRenderer();

      const orchestrator = new ThumbnailRenderOrchestrator(
        createMockKeyDeriver(),
        createMockRenderQueue(),
        renderer,
        cloudCache,
        localCache
      );

      const result = await orchestrator.getThumbnail(createTestRequest());

      expect(result.fromCache).toBe(true);
      expect(localCache.get).toHaveBeenCalled();
      expect(cloudCache.getUrl).not.toHaveBeenCalled();
      expect(renderer.render).not.toHaveBeenCalled();
    });

    it("skips local cache when skipCache is true", async () => {
      const cachedBlob = new Blob(["cached"], { type: "image/webp" });
      const localCache = createMockLocalCache(cachedBlob);
      const cloudCache = createMockCloudCache("https://cloud.url/thumb.webp");

      const orchestrator = new ThumbnailRenderOrchestrator(
        createMockKeyDeriver(),
        createMockRenderQueue(),
        createMockRenderer(),
        cloudCache,
        localCache
      );

      const request = createTestRequest();
      request.skipCache = true;

      await orchestrator.getThumbnail(request);

      expect(localCache.get).not.toHaveBeenCalled();
    });
  });

  describe("Tier 3: Cloud Cache", () => {
    it("checks cloud when local cache misses", async () => {
      const localCache = createMockLocalCache(null);
      const cloudCache = createMockCloudCache();
      cloudCache.getCachedUrl = vi.fn().mockReturnValue(undefined);
      cloudCache.getUrl = vi.fn().mockResolvedValue("https://cloud.url/thumb.webp");

      const orchestrator = new ThumbnailRenderOrchestrator(
        createMockKeyDeriver(),
        createMockRenderQueue(),
        createMockRenderer(),
        cloudCache,
        localCache
      );

      const result = await orchestrator.getThumbnail(createTestRequest());

      expect(result.fromCache).toBe(true);
      expect(localCache.get).toHaveBeenCalled();
      expect(cloudCache.getUrl).toHaveBeenCalled();
    });

    it("uses in-memory cached URL when available", async () => {
      const localCache = createMockLocalCache(null);
      const cloudCache = createMockCloudCache();
      cloudCache.getCachedUrl = vi.fn().mockReturnValue("https://memory-cached.url/thumb.webp");

      const orchestrator = new ThumbnailRenderOrchestrator(
        createMockKeyDeriver(),
        createMockRenderQueue(),
        createMockRenderer(),
        cloudCache,
        localCache
      );

      const result = await orchestrator.getThumbnail(createTestRequest());

      expect(result.fromCache).toBe(true);
      expect(cloudCache.getCachedUrl).toHaveBeenCalled();
      expect(cloudCache.getUrl).not.toHaveBeenCalled(); // Shouldn't need network
    });
  });

  describe("Tier 4: Local Render", () => {
    it("renders when all caches miss", async () => {
      const localCache = createMockLocalCache(null);
      const cloudCache = createMockCloudCache();
      cloudCache.getCachedUrl = vi.fn().mockReturnValue(undefined);
      cloudCache.getUrl = vi.fn().mockResolvedValue(null);
      const renderer = createMockRenderer();

      const orchestrator = new ThumbnailRenderOrchestrator(
        createMockKeyDeriver(),
        createMockRenderQueue(),
        renderer,
        cloudCache,
        localCache
      );

      const result = await orchestrator.getThumbnail(createTestRequest());

      expect(result.fromCache).toBe(false);
      expect(renderer.render).toHaveBeenCalled();
    });

    it("saves rendered blob to local cache", async () => {
      const localCache = createMockLocalCache(null);
      const cloudCache = createMockCloudCache();
      cloudCache.getCachedUrl = vi.fn().mockReturnValue(undefined);
      cloudCache.getUrl = vi.fn().mockResolvedValue(null);

      const orchestrator = new ThumbnailRenderOrchestrator(
        createMockKeyDeriver(),
        createMockRenderQueue(),
        createMockRenderer(),
        cloudCache,
        localCache
      );

      await orchestrator.getThumbnail(createTestRequest());

      expect(localCache.set).toHaveBeenCalled();
    });

    it("uploads to cloud when usesDefaults is true", async () => {
      const localCache = createMockLocalCache(null);
      const cloudCache = createMockCloudCache();
      cloudCache.getCachedUrl = vi.fn().mockReturnValue(undefined);
      cloudCache.getUrl = vi.fn().mockResolvedValue(null);

      const orchestrator = new ThumbnailRenderOrchestrator(
        createMockKeyDeriver({ usesDefaults: true }),
        createMockRenderQueue(),
        createMockRenderer(),
        cloudCache,
        localCache
      );

      await orchestrator.getThumbnail(createTestRequest());

      expect(cloudCache.upload).toHaveBeenCalled();
    });

    it("does NOT upload to cloud when usesDefaults is false", async () => {
      const localCache = createMockLocalCache(null);
      const cloudCache = createMockCloudCache();
      cloudCache.getCachedUrl = vi.fn().mockReturnValue(undefined);
      cloudCache.getUrl = vi.fn().mockResolvedValue(null);

      const orchestrator = new ThumbnailRenderOrchestrator(
        createMockKeyDeriver({ usesDefaults: false }),
        createMockRenderQueue(),
        createMockRenderer(),
        cloudCache,
        localCache
      );

      await orchestrator.getThumbnail(createTestRequest());

      // Local cache should still be set (works for all thumbnails)
      expect(localCache.set).toHaveBeenCalled();
      // But cloud should NOT be uploaded (only for defaults)
      expect(cloudCache.upload).not.toHaveBeenCalled();
    });
  });

  describe("Cat-Dog Mode (Unified Treatment)", () => {
    it("caches cat-dog thumbnails in local cache same as regular", async () => {
      const localCache = createMockLocalCache(null);
      const cloudCache = createMockCloudCache();
      cloudCache.getCachedUrl = vi.fn().mockReturnValue(undefined);
      cloudCache.getUrl = vi.fn().mockResolvedValue(null);

      // Cat-dog mode: different props per hand, usesDefaults false
      const catDogKeyDeriver = createMockKeyDeriver({
        usesDefaults: false,
        propKey: `catdog_${PropType.STAFF}_${PropType.BUUGENG}`,
      });

      const orchestrator = new ThumbnailRenderOrchestrator(
        catDogKeyDeriver,
        createMockRenderQueue(),
        createMockRenderer(),
        cloudCache,
        localCache
      );

      const request = createTestRequest();
      request.input.catDogModeEnabled = true;
      request.input.bluePropType = PropType.STAFF;
      request.input.redPropType = PropType.BUUGENG;

      await orchestrator.getThumbnail(request);

      // Cat-dog should be cached locally (unified system)
      expect(localCache.set).toHaveBeenCalled();
    });

    it("retrieves cat-dog thumbnails from local cache", async () => {
      const cachedBlob = new Blob(["catdog-cached"], { type: "image/webp" });
      const localCache = createMockLocalCache(cachedBlob);

      const catDogKeyDeriver = createMockKeyDeriver({
        usesDefaults: false,
        propKey: `catdog_${PropType.STAFF}_${PropType.BUUGENG}`,
      });

      const orchestrator = new ThumbnailRenderOrchestrator(
        catDogKeyDeriver,
        createMockRenderQueue(),
        createMockRenderer(),
        createMockCloudCache(),
        localCache
      );

      const result = await orchestrator.getThumbnail(createTestRequest());

      expect(result.fromCache).toBe(true);
      expect(localCache.get).toHaveBeenCalled();
    });
  });
});
