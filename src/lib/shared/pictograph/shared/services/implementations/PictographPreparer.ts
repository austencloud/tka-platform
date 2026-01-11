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
import { getSettings } from "../../../../application/state/app-state.svelte";

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

      // Log cache stats periodically
      if ((this.cacheHits + this.cacheMisses) % 100 === 0) {
        const hitRate = ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(0);
        console.log(`[Preparer] Cache: ${this.cacheHits} hits, ${this.cacheMisses} misses (${hitRate}% hit rate)`);
      }

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
    // Pass themeMode to arrow lifecycle for correct color selection
    const arrowResult = await this.arrowManager.coordinateArrowLifecycle(
      pictograph,
      options?.themeMode ? { themeMode: options.themeMode } : undefined
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
   */
  private deriveCacheKey(pictograph: PictographData, options?: PrepareOptions): string {
    const blue = pictograph.motions?.blue;
    const red = pictograph.motions?.red;

    // Key components that affect arrow/prop positioning
    const parts = [
      // Blue motion
      blue?.motionType ?? "none",
      blue?.startLocation ?? "",
      blue?.endLocation ?? "",
      blue?.rotationDirection ?? "",
      blue?.turns ?? 0,
      options?.bluePropType ?? blue?.propType ?? "",
      // Red motion
      red?.motionType ?? "none",
      red?.startLocation ?? "",
      red?.endLocation ?? "",
      red?.rotationDirection ?? "",
      red?.turns ?? 0,
      options?.redPropType ?? red?.propType ?? "",
      // Theme affects colors
      options?.themeMode ?? "dark",
    ];

    return parts.join("|");
  }

  private deriveGridMode(pictograph: PictographData): GridMode {
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
    const settings = getSettings();

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
    settings: ReturnType<typeof getSettings>,
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

        // No explicit prop type provided - fall back to global settings
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
}
