/**
 * Arrow Placement Data Service
 *
 * Loads and manages arrow placement JSON data for positioning calculations.
 * Ports the exact functionality from desktop DefaultPlacer.
 */

import type { MotionType } from "../../../../shared/domain/enums/pictograph-enums";
import { GridMode } from "../../../../grid/domain/enums/grid-enums";
import { jsonCache } from "$lib/shared/pictograph/shared/services/simple-json-cache";
import type { SimpleJsonCache } from '$lib/shared/pictograph/shared/services/simple-json-cache'
import type {
  GridPlacementData,
  JsonPlacementData,
} from "../domain/models/placement-data-types";
/**
 * Optional Firestore-first override for default base adjustments. Registered by
 * default-override-singleton on init. Unset in workers / pre-auth → pure JSON.
 * Returns the stored base [x, y] or null to fall through to the static map.
 */
export type DefaultOverrideResolver = (
  gridMode: string,
  motionType: string,
  placementKey: string,
  turns: string,
  propType: string,
) => [number, number] | null;

let defaultOverrideResolver: DefaultOverrideResolver | null = null;

export function setDefaultOverrideResolver(fn: DefaultOverrideResolver | null): void {
  defaultOverrideResolver = fn;
}

/**
 * Bucket keys for halved-arrow (segment) default-tier placements. Siblings of
 * MotionType, not members of it — a half-motion frame is letterless and looked
 * up by its own bucket ("pro_half" etc.), never by extending motionTypes.
 */
export type SegmentPlacementKey = "pro_half" | "anti_half" | "dash_half" | "static_half";

export class ArrowPlacer {
  private jsonCacheImpl: SimpleJsonCache;

  // [gridMode][propType][motionType][placementKey][turns] = [x, y]
  private allPlacements: Record<string, Record<string, GridPlacementData>> = {};

  // Lazily-loaded (gridMode, propType) buckets, e.g. "diamond:fan".
  private loadedKeys = new Set<string>();

  // Props with their own seeded subfolder. Anything else resolves to staff root.
  // MUST stay in sync with SEED_PROPS in scripts/seed-prop-default-placements.mjs —
  // a prop listed here but not seeded there reads a <prop>/ folder that doesn't
  // exist (silent staff fallback), and vice-versa.
  private static readonly SEEDED_PROPS = new Set([
    "fan", "bigfan", "club", "bigclub", "triad", "bigtriad",
    "minihoop", "bighoop", "buugeng", "bigbuugeng",
    "doublestar", "bigdoublestar", "eightrings", "bigeightrings",
  ]);

  private readonly motionTypes = ["pro", "anti", "float", "dash", "static"] as const;

  // Sibling bucket for halved-arrow default placements — NOT added to
  // motionTypes above. A half-motion frame is letterless, so it never goes
  // through the letter tiers; it reads its own pro_half/anti_half/dash_half/
  // static_half file instead. float has no half variant (no shift-turns
  // concept to split).
  private readonly segmentMotionTypes = ["pro_half", "anti_half", "dash_half", "static_half"] as const;

  /** Resolve the motion-type file paths for a (gridMode, propType). Seeded
   *  props read their <prop>/ subfolder; staff and unseeded props read root.
   *  The 4 _half segment files are staff-root only (v1) — seeded prop buckets
   *  skip them so a prop bucket doesn't fire 4 spurious missing-file warnings
   *  for data that hasn't been authored per-prop yet. */
  private filesFor(gridMode: string, propType: string): Record<string, string> {
    const seeded = ArrowPlacer.SEEDED_PROPS.has(propType);
    const sub = seeded ? `${propType}/` : "";
    const files: Record<string, string> = {};
    for (const mt of this.motionTypes) {
      files[mt] = `/data/arrow_placement/${gridMode}/default/${sub}default_${gridMode}_${mt}_placements.json`;
    }
    if (sub === "") {
      for (const mt of this.segmentMotionTypes) {
        files[mt] = `/data/arrow_placement/${gridMode}/default/default_${gridMode}_${mt}_placements.json`;
      }
    }
    return files;
  }

  /**
   * Create ArrowPlacer with optional injectable JSON cache
   * @param jsonCacheImpl JSON cache implementation (defaults to browser fetch-based cache)
   */
  constructor(jsonCacheImpl?: SimpleJsonCache) {
    this.jsonCacheImpl = jsonCacheImpl ?? jsonCache;
  }

  /**
   * Load all placement data from JSON files (staff, diamond + box)
   * @deprecated Use ensureLoaded(gridMode, propType) for lazy prop-aware loading
   */
  async loadPlacementData(): Promise<void> {
    // Load both grid modes for backwards compatibility (staff scope)
    await this.ensureLoaded(GridMode.DIAMOND, "staff");
    await this.ensureLoaded(GridMode.BOX, "staff");
  }

  /**
   * Ensure placement data is loaded for a specific (grid mode, prop type).
   * Only loads 5 files per bucket. SKEWED loads BOTH diamond and box for the
   * same prop (arrows can end at cardinal or intercardinal positions).
   */
  async ensureLoaded(gridMode: GridMode, propType: string): Promise<void> {
    if (gridMode === GridMode.SKEWED) {
      await this.ensureLoaded(GridMode.DIAMOND, propType);
      await this.ensureLoaded(GridMode.BOX, propType);
      return;
    }
    const key = `${gridMode}:${propType}`;
    if (this.loadedKeys.has(key)) return;
    // loadPlacements swallows per-file fetch errors to {} (a missing file is a
    // legitimate empty dataset), so the bucket is cached as-loaded even on a
    // failed fetch — same contract as the pre-prop loader. Missing → {0,0}.
    await this.loadPlacements(gridMode, propType);
    this.loadedKeys.add(key);
  }

  /** Back-compat: staff-scoped load. Prefer ensureLoaded(gridMode, propType). */
  async ensureGridModeLoaded(gridMode: GridMode): Promise<void> {
    await this.ensureLoaded(gridMode, "staff");
  }

  private async loadPlacements(gridMode: GridMode, propType: string): Promise<void> {
    const files = this.filesFor(gridMode, propType);
    this.allPlacements[gridMode] ??= {};
    const byMotion: GridPlacementData = {};
    for (const [motionType, filePath] of Object.entries(files)) {
      try {
        const raw = await this.loadJsonFile(filePath);
        const filtered: GridPlacementData[string] = {};
        for (const [placementKey, turnsData] of Object.entries(raw ?? {})) {
          filtered[placementKey] = {};
          for (const [turns, coords] of Object.entries(turnsData ?? {})) {
            if (Array.isArray(coords) && coords.length === 2 &&
                typeof coords[0] === "number" && typeof coords[1] === "number") {
              filtered[placementKey][turns] = coords as unknown as [number, number];
            }
          }
        }
        byMotion[motionType] = filtered;
      } catch (error) {
        console.warn(`Could not load ${motionType} placements for ${gridMode}/${propType}: ${error}`);
        byMotion[motionType] = {};
      }
    }
    this.allPlacements[gridMode][propType] = byMotion;
  }

  /**
   * Load JSON file with caching
   */
  private async loadJsonFile(path: string): Promise<JsonPlacementData> {
    try {
      const data = await this.jsonCacheImpl.get(path);
      return data as JsonPlacementData;
    } catch (error) {
      console.warn(`Failed to load placement data from ${path}:`, error);
      return {};
    }
  }

  /**
   * Get default adjustment using placement key and turns
   */
  async getDefaultAdjustment(
    motionType: MotionType | SegmentPlacementKey,
    placementKey: string,
    turns: number | string,
    gridMode: GridMode = GridMode.DIAMOND,
    propType: string = "staff",
  ): Promise<{ x: number; y: number }> {
    // SEEDED_PROPS holds lowercase keys; normalize once so a non-lowercased
    // caller can't silently miss its bucket and fall back to staff.
    const prop = propType.toLowerCase();
    await this.ensureLoaded(gridMode, prop);
    const turnsStr = this.formatTurnsForLookup(turns);

    // Firestore-first: an admin default override shadows the static JSON value.
    const override = defaultOverrideResolver
      ? defaultOverrideResolver(
          gridMode as unknown as string,
          motionType as unknown as string,
          placementKey,
          turnsStr,
          prop,
        )
      : null;
    if (override) return { x: override[0], y: override[1] };

    const adjustment =
      this.allPlacements[gridMode]?.[prop]?.[motionType]?.[placementKey]?.[turnsStr];
    if (!adjustment) return { x: 0, y: 0 };
    return { x: adjustment[0], y: adjustment[1] };
  }

  // The enumeration/debug helpers below are intentionally staff-scoped: they
  // back editor key-listing, and seeded prop datasets are byte-copies of staff
  // (identical key sets). If a prop dataset ever diverges in its KEY set (not
  // just values), thread propType through these too.

  /**
   * Get available placement keys for a motion type
   */
  async getAvailablePlacementKeys(
    motionType: MotionType,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<string[]> {
    await this.ensureLoaded(gridMode, "staff");

    const motionPlacements = this.allPlacements[gridMode]?.["staff"]?.[motionType];
    if (!motionPlacements) {
      return [];
    }

    return Object.keys(motionPlacements);
  }

  /**
   * Check if staff data is loaded for a grid mode (or diamond if not specified)
   */
  isLoaded(gridMode?: GridMode): boolean {
    if (gridMode) {
      // SKEWED mode requires both DIAMOND and BOX staff buckets to be loaded
      if (gridMode === GridMode.SKEWED) {
        return this.loadedKeys.has(`${GridMode.DIAMOND}:staff`) &&
               this.loadedKeys.has(`${GridMode.BOX}:staff`);
      }
      return this.loadedKeys.has(`${gridMode}:staff`);
    }
    // For backwards compatibility, check if at least diamond staff is loaded
    return this.loadedKeys.has(`${GridMode.DIAMOND}:staff`);
  }

  /**
   * Format turns value for JSON lookup
   * Converts: 1.0 → "1", 0.5 → "0.5", etc.
   */
  private formatTurnsForLookup(turns: number | string): string {
    if (typeof turns === "string") {
      return turns; // Already formatted (e.g., "fl" for float)
    }

    // Convert numbers: remove .0 for whole numbers
    if (turns === Math.floor(turns)) {
      return Math.floor(turns).toString();
    }

    return turns.toString();
  }

  /**
   * Debug method to log available keys
   */
  async debugAvailableKeys(
    motionType: MotionType,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<string[]> {
    const keys = await this.getAvailablePlacementKeys(motionType, gridMode);
    return keys;
  }

  /**
   * Get raw placement data for debugging
   */
  async getPlacementData(
    motionType: MotionType,
    placementKey: string,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<{ [turns: string]: [number, number] }> {
    await this.ensureLoaded(gridMode, "staff");

    const motionPlacements = this.allPlacements[gridMode]?.["staff"]?.[motionType];
    return motionPlacements?.[placementKey] || {};
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowPlacer to avoid DI container rebuilds.
// Uses the default jsonCache singleton.
// ============================================================================

export const arrowPlacer = new ArrowPlacer();
