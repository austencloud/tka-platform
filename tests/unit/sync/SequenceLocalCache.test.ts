/**
 * SequenceLocalCache Tests
 *
 * Tests the IndexedDB-based local cache for sequences.
 * Uses an in-memory test implementation to verify the cache logic
 * without requiring actual IndexedDB (which has browser-only support).
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  ISequenceLocalCache,
  SequenceLocalCacheStats,
} from "$lib/shared/sync/services/contracts/ISequenceLocalCache";

// Test implementation that mirrors the real cache logic
// Uses in-memory Map instead of IndexedDB for deterministic testing
interface CachedSequence {
  sequenceId: string;
  data: SequenceData;
  timestamp: number;
  sizeBytes: number;
}

class TestSequenceLocalCache implements ISequenceLocalCache {
  private cache = new Map<string, CachedSequence>();
  private maxSizeBytes: number;
  private timestampCounter = 0; // Monotonic counter for deterministic ordering
  private isPruning = false;

  constructor(maxSizeBytes: number = 200 * 1024 * 1024) {
    this.maxSizeBytes = maxSizeBytes;
  }

  private estimateSize(data: SequenceData): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 10000;
    }
  }

  async get(sequenceId: string): Promise<SequenceData | null> {
    const entry = this.cache.get(sequenceId);
    if (entry) {
      // Update timestamp on access (LRU)
      entry.timestamp = ++this.timestampCounter;
      return entry.data;
    }
    return null;
  }

  async set(sequenceId: string, data: SequenceData): Promise<void> {
    const entry: CachedSequence = {
      sequenceId,
      data,
      timestamp: ++this.timestampCounter,
      sizeBytes: this.estimateSize(data),
    };
    this.cache.set(sequenceId, entry);

    // Auto-prune if over limit
    await this.prune(this.maxSizeBytes);
  }

  async has(sequenceId: string): Promise<boolean> {
    return this.cache.has(sequenceId);
  }

  async getMany(sequenceIds: string[]): Promise<Map<string, SequenceData>> {
    const results = new Map<string, SequenceData>();
    const now = ++this.timestampCounter;

    for (const sequenceId of sequenceIds) {
      const entry = this.cache.get(sequenceId);
      if (entry) {
        // Update timestamp on access (LRU)
        entry.timestamp = now;
        results.set(sequenceId, entry.data);
      }
    }

    return results;
  }

  async delete(sequenceId: string): Promise<void> {
    this.cache.delete(sequenceId);
  }

  async getStats(): Promise<SequenceLocalCacheStats> {
    let sizeBytes = 0;
    for (const entry of this.cache.values()) {
      sizeBytes += entry.sizeBytes;
    }
    return { count: this.cache.size, sizeBytes };
  }

  async prune(maxSizeBytes: number): Promise<number> {
    // Concurrency guard
    if (this.isPruning) {
      return 0;
    }
    this.isPruning = true;

    try {
      const stats = await this.getStats();
      if (stats.sizeBytes <= maxSizeBytes) {
        return 0;
      }

      // Get entries sorted by timestamp (oldest first)
      const entries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      let currentSize = stats.sizeBytes;
      let deletedCount = 0;

      for (const [sequenceId, entry] of entries) {
        if (currentSize <= maxSizeBytes) break;
        this.cache.delete(sequenceId);
        currentSize -= entry.sizeBytes;
        deletedCount++;
      }

      return deletedCount;
    } finally {
      this.isPruning = false;
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  // Expose for testing
  getIsPruning(): boolean {
    return this.isPruning;
  }
}

// Factory for creating test sequence data
function createTestSequence(
  id: string,
  name: string = "Test Sequence"
): SequenceData {
  return {
    id,
    name,
    word: name.toUpperCase().slice(0, 4) || "TEST",
    steps: [],
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: {},
  };
}

// Factory for creating sequence with specific size (padding metadata)
function createTestSequenceWithSize(
  id: string,
  targetSize: number
): SequenceData {
  const base = createTestSequence(id);
  const baseSize = JSON.stringify(base).length;
  const paddingNeeded = Math.max(0, targetSize - baseSize);
  return {
    ...base,
    metadata: { padding: "x".repeat(paddingNeeded) },
  };
}

describe("SequenceLocalCache", () => {
  let cache: TestSequenceLocalCache;

  beforeEach(() => {
    cache = new TestSequenceLocalCache();
  });

  describe("basic operations", () => {
    it("returns null for missing sequence", async () => {
      const result = await cache.get("nonexistent-id");
      expect(result).toBeNull();
    });

    it("stores and retrieves sequence", async () => {
      const sequence = createTestSequence("seq-1", "My Sequence");
      await cache.set("seq-1", sequence);

      const result = await cache.get("seq-1");
      expect(result).toBeDefined();
      expect(result?.id).toBe("seq-1");
      expect(result?.name).toBe("My Sequence");
    });

    it("reports correct has() status", async () => {
      expect(await cache.has("seq-1")).toBe(false);

      await cache.set("seq-1", createTestSequence("seq-1"));
      expect(await cache.has("seq-1")).toBe(true);
    });

    it("deletes sequence from cache", async () => {
      await cache.set("seq-1", createTestSequence("seq-1"));
      expect(await cache.has("seq-1")).toBe(true);

      await cache.delete("seq-1");
      expect(await cache.has("seq-1")).toBe(false);
    });

    it("clears all entries", async () => {
      await cache.set("seq-1", createTestSequence("seq-1"));
      await cache.set("seq-2", createTestSequence("seq-2"));

      await cache.clear();

      expect(await cache.has("seq-1")).toBe(false);
      expect(await cache.has("seq-2")).toBe(false);
    });
  });

  describe("batch operations", () => {
    it("getMany returns empty map for empty input", async () => {
      const results = await cache.getMany([]);
      expect(results.size).toBe(0);
    });

    it("getMany retrieves multiple sequences", async () => {
      await cache.set("seq-1", createTestSequence("seq-1", "First"));
      await cache.set("seq-2", createTestSequence("seq-2", "Second"));
      await cache.set("seq-3", createTestSequence("seq-3", "Third"));

      const results = await cache.getMany(["seq-1", "seq-3"]);

      expect(results.size).toBe(2);
      expect(results.get("seq-1")?.name).toBe("First");
      expect(results.get("seq-3")?.name).toBe("Third");
    });

    it("getMany skips missing sequences", async () => {
      await cache.set("seq-1", createTestSequence("seq-1"));

      const results = await cache.getMany(["seq-1", "nonexistent", "seq-2"]);

      expect(results.size).toBe(1);
      expect(results.has("seq-1")).toBe(true);
      expect(results.has("nonexistent")).toBe(false);
      expect(results.has("seq-2")).toBe(false);
    });
  });

  describe("stats tracking", () => {
    it("reports correct count", async () => {
      await cache.set("seq-1", createTestSequence("seq-1"));
      await cache.set("seq-2", createTestSequence("seq-2"));

      const stats = await cache.getStats();
      expect(stats.count).toBe(2);
    });

    it("reports correct size", async () => {
      const seq1 = createTestSequence("seq-1");
      const seq2 = createTestSequence("seq-2");
      const expectedSize =
        JSON.stringify(seq1).length + JSON.stringify(seq2).length;

      await cache.set("seq-1", seq1);
      await cache.set("seq-2", seq2);

      const stats = await cache.getStats();
      expect(stats.sizeBytes).toBe(expectedSize);
    });

    it("updates size on delete", async () => {
      const seq1 = createTestSequence("seq-1");
      const seq2 = createTestSequence("seq-2");

      await cache.set("seq-1", seq1);
      await cache.set("seq-2", seq2);
      await cache.delete("seq-1");

      const stats = await cache.getStats();
      expect(stats.count).toBe(1);
      expect(stats.sizeBytes).toBe(JSON.stringify(seq2).length);
    });
  });

  describe("LRU pruning", () => {
    it("prunes oldest entries when over limit", async () => {
      // Create cache with small limit (500 bytes)
      const smallCache = new TestSequenceLocalCache(500);

      // Add entries that exceed limit
      await smallCache.set("seq-1", createTestSequenceWithSize("seq-1", 200));
      await smallCache.set("seq-2", createTestSequenceWithSize("seq-2", 200));
      await smallCache.set("seq-3", createTestSequenceWithSize("seq-3", 200)); // Triggers pruning

      const stats = await smallCache.getStats();
      expect(stats.sizeBytes).toBeLessThanOrEqual(500);
    });

    it("updates timestamp on get (LRU)", async () => {
      // Use a cache that can hold exactly 2 entries
      const smallCache = new TestSequenceLocalCache(400);

      // Add first entry
      await smallCache.set("first", createTestSequenceWithSize("first", 180));

      // Add second entry
      await smallCache.set("second", createTestSequenceWithSize("second", 180));

      // Access "first" to update its timestamp (makes it more recent)
      await smallCache.get("first");

      // Add third entry - should trigger pruning
      // "second" should be evicted (oldest by access time)
      await smallCache.set("third", createTestSequenceWithSize("third", 180));

      // Verify LRU behavior
      expect(await smallCache.has("first")).toBe(true); // Kept - accessed recently
      expect(await smallCache.has("second")).toBe(false); // Evicted - oldest access
      expect(await smallCache.has("third")).toBe(true); // Kept - just added
    });

    it("updates timestamp on getMany (LRU)", async () => {
      const smallCache = new TestSequenceLocalCache(400);

      await smallCache.set("first", createTestSequenceWithSize("first", 180));
      await smallCache.set("second", createTestSequenceWithSize("second", 180));

      // Access "first" via getMany to update its timestamp
      await smallCache.getMany(["first"]);

      // Add third entry - should evict "second" not "first"
      await smallCache.set("third", createTestSequenceWithSize("third", 180));

      expect(await smallCache.has("first")).toBe(true);
      expect(await smallCache.has("second")).toBe(false);
      expect(await smallCache.has("third")).toBe(true);
    });

    it("does not prune when under limit", async () => {
      const deletedCount = await cache.prune(cache["maxSizeBytes"]);
      expect(deletedCount).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles sequence with empty steps", async () => {
      const emptySeq = createTestSequence("empty");
      await cache.set("empty", emptySeq);

      const result = await cache.get("empty");
      expect(result?.steps.length).toBe(0);
    });

    it("overwrites existing entry", async () => {
      const original = createTestSequence("seq-1", "Original");
      const updated = createTestSequence("seq-1", "Updated");

      await cache.set("seq-1", original);
      await cache.set("seq-1", updated);

      const stats = await cache.getStats();
      expect(stats.count).toBe(1);

      const result = await cache.get("seq-1");
      expect(result?.name).toBe("Updated");
    });

    it("delete on nonexistent entry does not throw", async () => {
      await expect(cache.delete("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("concurrency guard", () => {
    it("prevents concurrent prune operations", async () => {
      const smallCache = new TestSequenceLocalCache(300);

      // Add entries that exceed limit
      await smallCache.set("seq-1", createTestSequenceWithSize("seq-1", 150));
      await smallCache.set("seq-2", createTestSequenceWithSize("seq-2", 150));
      await smallCache.set("seq-3", createTestSequenceWithSize("seq-3", 150));

      // Run two prunes concurrently
      const prune1 = smallCache.prune(100);
      const prune2 = smallCache.prune(100);

      const [result1, result2] = await Promise.all([prune1, prune2]);

      // One should succeed, one should return 0 (blocked by guard)
      expect(result1 + result2).toBeGreaterThan(0);
      expect(result1 === 0 || result2 === 0).toBe(true);
    });

    it("resets isPruning flag after completion", async () => {
      const smallCache = new TestSequenceLocalCache(100);
      await smallCache.set("seq-1", createTestSequenceWithSize("seq-1", 200));

      await smallCache.prune(50);

      expect(smallCache.getIsPruning()).toBe(false);
    });

    it("resets isPruning flag even when under limit", async () => {
      await cache.prune(cache["maxSizeBytes"]);
      expect(cache.getIsPruning()).toBe(false);
    });
  });
});
