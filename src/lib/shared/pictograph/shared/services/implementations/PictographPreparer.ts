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
    // Pass themeMode and gridMode to arrow lifecycle for correct positioning and color selection
    const arrowResult = await this.arrowManager.coordinateArrowLifecycle(
      pictograph,
      { themeMode: options?.themeMode, gridMode }
    );
    const { propPositions, propAssets } = await this.calculateProps(
      pictograph,
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
      // Blue motion
      blue?.motionType ?? "none",
      blue?.startLocation ?? "",
      blue?.endLocation ?? "",
      blue?.rotationDirection ?? "",
      blue?.turns ?? 0,
      // Prop type: explicit option > motion's embedded type > global settings
      options?.bluePropType ?? blue?.propType ?? globalSettings.bluePropType ?? "",
      // Blue manual adjustments (for admin arrow positioning via WASD)
      blue?.arrowPlacementData?.manualAdjustmentX ?? 0,
      blue?.arrowPlacementData?.manualAdjustmentY ?? 0,
      // Red motion
      red?.motionType ?? "none",
      red?.startLocation ?? "",
      red?.endLocation ?? "",
      red?.rotationDirection ?? "",
      red?.turns ?? 0,
      // Prop type: explicit option > motion's embedded type > global settings
      options?.redPropType ?? red?.propType ?? globalSettings.redPropType ?? "",
      // Red manual adjustments (for admin arrow positioning via WASD)
      red?.arrowPlacementData?.manualAdjustmentX ?? 0,
      red?.arrowPlacementData?.manualAdjustmentY ?? 0,
      // Theme affects colors
      options?.themeMode ?? "dark",
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

    await Promise.all(
      motions.map(async ([color, motion]) => {
        try {
          if (!motion.propPlacementData) return;

          const [renderData, placementData] = await Promise.all([
            this.propLoader.loadPropSvg(
              motion.propPlacementData,
              motion,
              false, // useAnimatedVersion
              options?.themeMode ? { themeMode: options.themeMode } : undefined
            ),
            this.propPlacer.calculatePlacement(pictograph, motion),
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

        // If motion already has a propType set (cat-dog mode / mixed props),
        // use it instead of falling back to global settings
        if (motion.propType !== undefined) {
          return [color, motion] as [string, MotionData];
        }

        // No explicit prop type on motion - fall back to global settings
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
   * Clear the preparation cache.
   * Call this when global adjustments change to force re-calculation of all pictographs.
   */
  clearCache(): void {
    this.prepareCache.clear();
    this.pendingPrepares.clear();
  }
}
