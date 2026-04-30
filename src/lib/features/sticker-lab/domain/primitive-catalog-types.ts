import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import type { MandalaPrimitiveRef } from "./sticker-types";

/**
 * One entry in the Stage A primitive catalog.
 *
 * Stage A: shapeHash and ultraHash are sequenceId proxies.
 * Stage B: replaced by geometric SHA-256 hashes from MandalaCanonicalizer.
 *
 * `paths` is nullable because Stage A ships entries without pre-baked paths -
 * the mandala-paths-cache falls back to the sequence repository at runtime.
 */
export interface PrimitiveCatalogEntry {
  /** Stage A: sequenceId of canonical representative. Stage B: geometric SHA-256. */
  shapeHash: string;
  ultraHash: string;
  displayName: string;
  /**
   * Pre-baked MandalaPaths. Null in Stage A - paths are resolved at runtime
   * via the sequence repository fallback in mandala-paths-cache.
   */
  paths: MandalaPaths | null;
  /** Source LOOP back-link for the Stage A sequenceId proxy. */
  sourceLoop: {
    sequenceId: string;
    word: string;
    loopType: string;
  };
  /** Symmetry order derived from geometry (Stage A: always 1 - not yet computed). */
  symmetryOrder: number;
  /** Distinct ultra-equivalent variants within this shape class (Stage A: always 1). */
  ultraCount: number;
}

/** Top-level structure of `src/lib/features/sticker-lab/data/primitive-catalog.json`. */
export interface PrimitiveCatalog {
  /** Catalog format version. Bump on incompatible entry shape changes. */
  version: 1;
  generatedAt: number;
  totalEntries: number;
  entries: PrimitiveCatalogEntry[];
}

/** Runtime in-memory catalog produced by `loadPrimitiveCatalog()`. */
export interface LoadedPrimitiveCatalog {
  entries: PrimitiveCatalogEntry[];
  /** O(1) lookup by shapeHash. */
  byShapeHash: Map<string, PrimitiveCatalogEntry>;
}

/** Extract a MandalaPrimitiveRef from a catalog entry. */
export function entryToRef(entry: PrimitiveCatalogEntry): MandalaPrimitiveRef {
  return {
    shapeHash: entry.shapeHash,
    ultraHash: entry.ultraHash,
    sourceLoop: entry.sourceLoop,
    displayName: entry.displayName,
  };
}
