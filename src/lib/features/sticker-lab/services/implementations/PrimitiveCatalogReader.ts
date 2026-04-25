import type {
  PrimitiveCatalog,
  PrimitiveCatalogEntry,
  LoadedPrimitiveCatalog,
} from "../../domain/primitive-catalog-types";

let _loaded: LoadedPrimitiveCatalog | null = null;
let _loading: Promise<LoadedPrimitiveCatalog> | null = null;

/**
 * Load and cache the Stage A primitive catalog.
 *
 * Concurrent calls share one in-flight promise. The result is module-scoped
 * for the session lifetime.
 *
 * Stage B: replace this body to load from MandalaPrimitiveRegistry.
 * The return type is stable.
 */
export async function loadPrimitiveCatalog(): Promise<LoadedPrimitiveCatalog> {
  if (_loaded) return _loaded;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      const { default: catalog } = (await import(
        "$lib/features/sticker-lab/data/primitive-catalog.json"
      )) as { default: PrimitiveCatalog };
      const byShapeHash = new Map<string, PrimitiveCatalogEntry>(
        catalog.entries.map((e) => [e.shapeHash, e])
      );
      _loaded = { entries: catalog.entries, byShapeHash };
      return _loaded;
    } catch (err) {
      console.error("[PrimitiveCatalogReader] Failed to load catalog:", err);
      return { entries: [], byShapeHash: new Map() };
    } finally {
      _loading = null;
    }
  })();

  return _loading;
}

/** Synchronous peek — null until loadPrimitiveCatalog() resolves. */
export function getCatalogEntry(shapeHash: string): PrimitiveCatalogEntry | null {
  return _loaded?.byShapeHash.get(shapeHash) ?? null;
}

/** Reset module-level cache. For testing only. */
export function _resetCatalogForTesting(): void {
  _loaded = null;
  _loading = null;
}
