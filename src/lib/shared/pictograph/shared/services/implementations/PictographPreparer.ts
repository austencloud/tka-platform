/**
 * PictographPreparer - Batch prepares pictographs with positions
 *
 * Single responsibility: Calculate arrow/prop positions for pictographs.
 * Used before rendering to eliminate per-component async calculations.
 *
 * This is the SINGLE SOURCE OF TRUTH for position calculations.
 * Both batch rendering (option picker) and single rendering (PictographContainer)
 * should use this service.
 */

import type { PictographData } from "../../domain/models/PictographData";
import type { MotionData } from "../../domain/models/MotionData";
import type {
  PreparedPictographData,
  PreparedRenderData,
} from "../../domain/models/PreparedPictographData";
import type {
  IPictographPreparer,
  PrepareOptions,
} from "../contracts/IPictographPreparer";
import type { IArrowLifecycleManager } from "../../../arrow/orchestration/services/contracts/IArrowLifecycleManager";
import type { IPropSvgLoader } from "../../../prop/services/contracts/IPropSvgLoader";
import type { IPropPlacer } from "../../../prop/services/contracts/IPropPlacer";
import type { IGridModeDeriver } from "../../../grid/services/contracts/IGridModeDeriver";
import type { PropPosition } from "../../../prop/domain/models/PropPosition";
import type { PropAssets } from "../../../prop/domain/models/PropAssets";
import { GridMode } from "../../../grid/domain/enums/grid-enums";
import { PropType } from "../../../prop/domain/enums/PropType";
import { MotionType, HandPath } from "../../domain/enums/pictograph-enums";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";

export class PictographPreparer implements IPictographPreparer {
  // Cache prepared data to avoid re-calculating for identical pictographs
  private prepareCache = new Map<string, PreparedRenderData>();
  private pendingPrepares = new Map<string, Promise<PreparedRenderData>>();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private arrowManager: IArrowLifecycleManager,
    private propLoader: IPropSvgLoader,
    private propPlacer: IPropPlacer,
    private gridModeDeriver: IGridModeDeriver
  ) {}

  async prepareBatch(
    pictographs: PictographData[],
    options?: PrepareOptions
  ): Promise<PreparedPictographData[]> {
    return Promise.all(
      pictographs.map(async (p) => {
        try {
          return await this.prepareSingle(p, options);
        } catch (error) {
          console.error("Failed to prepare pictograph:", p.id, error);
          // Return unprepared data as fallback
          return p as PreparedPictographData;
        }
      })
    );
  }

  async prepareSingle(
    pictograph: PictographData,
    options?: PrepareOptions
  ): Promise<PreparedPictographData> {
    // Generate cache key from pictograph motion data + options
    const cacheKey = this.deriveCacheKey(pictograph, options);

    // Check cache first
    const cached = this.prepareCache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return { ...pictograph, _prepared: cached };
    }

    // Check if already preparing (deduplication)
    const pending = this.pendingPrepares.get(cacheKey);
    if (pending) {
      const prepared = await pending;
      return { ...pictograph, _prepared: prepared };
    }

    // Cache miss - do the expensive preparation
    this.cacheMisses++;
    const preparePromise = this.doPrepare(pictograph, options);
    this.pendingPrepares.set(cacheKey, preparePromise);

    try {
      const prepared = await preparePromise;
      this.prepareCache.set(cacheKey, prepared);

      return { ...pictograph, _prepared: prepared };
    } finally {
      this.pendingPrepares.delete(cacheKey);
    }
  }

  private async doPrepare(
    pictograph: PictographData,
    options?: PrepareOptions
  ): Promise<PreparedRenderData> {
    const gridMode = this.deriveGridMode(pictograph);

    // Hand path mode: transform motions before any position calculations.
    // Must happen FIRST so arrow lifecycle and prop placement see float motions.
    const effectivePictograph = options?.handPathMode
      ? this.transformForHandPath(pictograph)
      : pictograph;

    // Apply propType overrides BEFORE arrow lifecycle so the arrow adjustment
    // cascading lookup (SpecialPlacer) uses the correct prop-specific layer.
    // Without this, arrows always look up adjustments for the raw sequence propType
    // instead of the user's currently selected prop type from settings.
    const globalSettings = getSettings();
    const settings = {
      bluePropType: globalSettings.bluePropType,
      redPropType: globalSettings.redPropType,
    };
    const overriddenMotions = this.getMotionsWithOverrides(effectivePictograph, settings, options);
    const pictographWithPropOverrides: PictographData = {
      ...effectivePictograph,
      motions: Object.fromEntries(overriddenMotions) as PictographData["motions"],
    };

    // Pass themeMode and gridMode to arrow lifecycle for correct positioning and color selection
    const arrowResult = await this.arrowManager.coordinateArrowLifecycle(
      pictographWithPropOverrides,
      { themeMode: options?.themeMode, gridMode }
    );
    const { propPositions, propAssets } = await this.calculateProps(
      effectivePictograph,
      options
    );

    return {
      gridMode,
      arrowPositions: arrowResult.positions,
      arrowAssets: arrowResult.assets,
      arrowMirroring: arrowResult.mirroring,
      propPositions,
      propAssets,
    };
  }

  /**
   * Generate a cache key based on the pictograph's motion data and options.
   * Two pictographs with identical motions should share prepared data.
   * IMPORTANT: Must include current settings prop types to invalidate cache when settings change.
   */
  private deriveCacheKey(pictograph: PictographData, options?: PrepareOptions): string {
    const blue = pictograph.motions?.blue;
    const red = pictograph.motions?.red;

    // Get current settings for cache key (so cache invalidates when settings change)
    const globalSettings = getSettings();

    // Key components that affect arrow/prop positioning
    const parts = [
      // Letter affects arrow placement keys (e.g., pro_to_layer1_alpha_F vs _A)
      pictograph.letter ?? "none",
      // Blue motion
      blue?.motionType ?? "none",
      blue?.startLocation ?? "",
      blue?.endLocation ?? "",
      blue?.rotationDirection ?? "",
      blue?.turns ?? 0,
      // CRITICAL: Include orientations - prop rotation depends on endOrientation
      blue?.startOrientation ?? "",
      blue?.endOrientation ?? "",
      // Prop type: explicit option > global settings (viewer preference)
      options?.bluePropType ?? globalSettings.bluePropType ?? "",
      // Blue manual adjustments (for admin arrow positioning via WASD)
      blue?.arrowPlacementData?.manualAdjustmentX ?? 0,
      blue?.arrowPlacementData?.manualAdjustmentY ?? 0,
      // Red motion
      red?.motionType ?? "none",
      red?.startLocation ?? "",
      red?.endLocation ?? "",
      red?.rotationDirection ?? "",
      red?.turns ?? 0,
      // CRITICAL: Include orientations - prop rotation depends on endOrientation
      red?.startOrientation ?? "",
      red?.endOrientation ?? "",
      // Prop type: explicit option > global settings (viewer preference)
      options?.redPropType ?? globalSettings.redPropType ?? "",
      // Red manual adjustments (for admin arrow positioning via WASD)
      red?.arrowPlacementData?.manualAdjustmentX ?? 0,
      red?.arrowPlacementData?.manualAdjustmentY ?? 0,
      // Theme affects colors
      options?.themeMode ?? "dark",
      // Grid version uses ghost-half centered SVGs
      (options?.useGridVersion ?? false) ? "grid" : "thumbnail",
      // Hand path mode produces completely different motion transforms
      options?.handPathMode ? "hp" : "",
      // Motion visibility suppresses beta offset for the visible prop when the
      // partner is hidden. Use explicit `=== false` so undefined/true share a
      // cache slot (both mean "visible"). Only an explicit hide toggles a miss.
      options?.showBlueMotion === false ? "hideBlue" : "",
      options?.showRedMotion === false ? "hideRed" : "",
    ];

    return parts.join("|");
  }

  private deriveGridMode(pictograph: PictographData): GridMode {
    // First check if the pictograph already has gridMode set (from sequence data)
    if (pictograph.gridMode) {
      return pictograph.gridMode;
    }

    // No pre-set gridMode, derive from motion locations
    if (!pictograph.motions?.blue || !pictograph.motions?.red) {
      return GridMode.DIAMOND;
    }
    try {
      return this.gridModeDeriver.deriveGridMode(
        pictograph.motions.blue,
        pictograph.motions.red
      );
    } catch {
      return GridMode.DIAMOND;
    }
  }

  private async calculateProps(
    pictograph: PictographData,
    options?: PrepareOptions
  ): Promise<{
    propPositions: Record<string, PropPosition>;
    propAssets: Record<string, PropAssets>;
  }> {
    if (!pictograph.motions) {
      return { propPositions: {}, propAssets: {} };
    }

    const positions: Record<string, PropPosition> = {};
    const assets: Record<string, PropAssets> = {};
    // Get current settings for prop type fallback when options don't specify
    const globalSettings = getSettings();
    const settings = {
      bluePropType: globalSettings.bluePropType,
      redPropType: globalSettings.redPropType,
    };

    const motions = this.getMotionsWithOverrides(pictograph, settings, options);

    // Partner-visibility lets PropPlacer suppress beta offset when this prop's
    // partner is hidden — no collision partner means no overlap to avoid.
    const visibility = {
      showBlue: options?.showBlueMotion,
      showRed: options?.showRedMotion,
    };

    await Promise.all(
      motions.map(async ([color, motion]) => {
        try {
          if (!motion.propPlacementData) return;

          const [renderData, placementData] = await Promise.all([
            this.propLoader.loadPropSvg(
              motion.propPlacementData,
              motion,
              options?.useGridVersion ?? false,
              options?.themeMode ? { themeMode: options.themeMode } : undefined
            ),
            this.propPlacer.calculatePlacement(pictograph, motion, visibility),
          ]);

          if (!renderData.svgData) return;

          assets[color] = {
            imageSrc: renderData.svgData.svgContent,
            viewBox: `${renderData.svgData.viewBox.width} ${renderData.svgData.viewBox.height}`,
            center: renderData.svgData.center,
          };

          positions[color] = {
            x: placementData.positionX,
            y: placementData.positionY,
            rotation: placementData.rotationAngle,
          };
        } catch (error) {
          console.warn(`Failed to calculate ${color} prop:`, error);
        }
      })
    );

    return { propPositions: positions, propAssets: assets };
  }

  private getMotionsWithOverrides(
    pictograph: PictographData,
    settings: { bluePropType?: any; redPropType?: any },
    options?: PrepareOptions
  ): [string, MotionData][] {
    return Object.entries(pictograph.motions || {})
      .filter((entry): entry is [string, MotionData] => entry[1] !== undefined)
      .map(([color, motion]) => {
        // If motion explicitly uses HAND (e.g., Assembly mode), don't override
        if (motion.propType === PropType.HAND) {
          return [color, motion] as [string, MotionData];
        }

        // If explicit prop type provided via options, use it directly.
        // Export/thumbnail rendering always provides this to ensure consistency
        // during async operations (prevents race conditions from global settings changes).
        const explicitPropType =
          color === "blue" ? options?.bluePropType : options?.redPropType;
        if (explicitPropType !== undefined) {
          return [color, { ...motion, propType: explicitPropType }] as [
            string,
            MotionData,
          ];
        }

        // ALWAYS use global settings (viewer preference)
        // PropType is NOT sequence data - it's a viewer preference
        // All pictographs in a sequence MUST use the same global prop settings
        // (Blue vs red CAN differ via catDogMode, but all blues must match, all reds must match)
        const settingsPropType =
          color === "blue" ? settings.bluePropType : settings.redPropType;
        if (settingsPropType) {
          return [color, { ...motion, propType: settingsPropType }] as [
            string,
            MotionData,
          ];
        }
        return [color, motion] as [string, MotionData];
      });
  }

  /**
   * Transform motions for hand path visualization.
   * Pro/anti become float (shows spatial trajectory without prop rotation).
   * Dash stays dash. Static stays static. Orientation is nulled out
   * because hands don't have orientation — PropPlacer already returns
   * 0° rotation for HAND propType.
   */
  private transformForHandPath(pictograph: PictographData): PictographData {
    const motions = pictograph.motions;
    if (!motions) return pictograph;

    const transform = (motion: MotionData): MotionData => {
      const isShift =
        motion.motionType === MotionType.PRO ||
        motion.motionType === MotionType.ANTI;

      const handPath = this.deriveHandPath(
        motion.startLocation,
        motion.endLocation
      );

      return {
        ...motion,
        motionType: isShift ? MotionType.FLOAT : motion.motionType,
        turns: isShift ? ("fl" as const) : motion.turns,
        handPath: isShift ? handPath : (motion.handPath ?? null),
        startOrientation: undefined as any,
        endOrientation: undefined as any,
        propType: PropType.HAND,
      };
    };

    return {
      ...pictograph,
      motions: {
        blue: motions.blue ? transform(motions.blue) : undefined,
        red: motions.red ? transform(motions.red) : undefined,
      } as PictographData["motions"],
    };
  }

  /**
   * Derive handpath direction from start/end locations.
   * Maps location pairs to CW, CCW, DASH, or STATIC.
   */
  private deriveHandPath(
    startLocation: string,
    endLocation: string
  ): HandPath | null {
    const CW_PAIRS: [string, string][] = [
      ["s", "w"], ["w", "n"], ["n", "e"], ["e", "s"],
      ["ne", "se"], ["se", "sw"], ["sw", "nw"], ["nw", "ne"],
    ];
    const CCW_PAIRS: [string, string][] = [
      ["w", "s"], ["n", "w"], ["e", "n"], ["s", "e"],
      ["ne", "nw"], ["nw", "sw"], ["sw", "se"], ["se", "ne"],
    ];
    const DASH_PAIRS: [string, string][] = [
      ["s", "n"], ["w", "e"], ["n", "s"], ["e", "w"],
      ["ne", "sw"], ["se", "nw"], ["sw", "ne"], ["nw", "se"],
    ];

    const s = startLocation.toLowerCase();
    const e = endLocation.toLowerCase();

    if (s === e) return HandPath.STATIC;
    if (CW_PAIRS.some(([a, b]) => a === s && b === e)) return HandPath.CLOCKWISE;
    if (CCW_PAIRS.some(([a, b]) => a === s && b === e))
      return HandPath.COUNTER_CLOCKWISE;
    if (DASH_PAIRS.some(([a, b]) => a === s && b === e)) return HandPath.DASH;

    return null;
  }

  /**
   * Clear the preparation cache.
   * Call this when global adjustments change to force re-calculation of all pictographs.
   */
  clearCache(): void {
    this.prepareCache.clear();
    this.pendingPrepares.clear();
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of pictographPreparer to avoid DI container rebuilds.
// ============================================================================

import { arrowLifecycleManager } from "../../../arrow/orchestration/services/implementations/ArrowLifecycleManager";
import { propSvgLoader } from "../../../prop/services/implementations/PropSvgLoader";
import { propPlacer } from "../../../prop/services/implementations/PropPlacer";
import { gridModeDeriver } from "../../../grid/services/implementations/GridModeDeriver";


export const pictographPreparer = new PictographPreparer(
  arrowLifecycleManager,
  propSvgLoader,
  propPlacer,
  gridModeDeriver
);
