/**
 * Node.js Pictograph Preparer
 *
 * A Node.js-compatible version of PictographPreparer that doesn't depend on
 * Svelte state management. Used by the MCP server and CLI tools.
 *
 * This is a copy of PictographPreparer with the getSettings() import removed
 * and replaced with a default settings provider.
 */

import type { PictographData } from "../../src/lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "../../src/lib/shared/pictograph/shared/domain/models/MotionData";
import type {
  PreparedPictographData,
  PreparedRenderData,
} from "../../src/lib/shared/pictograph/shared/domain/models/PreparedPictographData";
import type {
  PrepareOptions,
} from "../../src/lib/shared/pictograph/shared/services/types";
import type { IArrowLifecycleManager } from "../../src/lib/shared/pictograph/arrow/orchestration/services/contracts/IArrowLifecycleManager";
import type { IPropSvgLoader } from "../../src/lib/shared/pictograph/prop/services/contracts/IPropSvgLoader";
import type { IPropPlacer } from "../../src/lib/shared/pictograph/prop/services/contracts/IPropPlacer";
import type { IGridModeDeriver } from "../../src/lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
import type { PropPosition } from "../../src/lib/shared/pictograph/prop/domain/models/PropPosition";
import type { PropAssets } from "../../src/lib/shared/pictograph/prop/domain/models/PropAssets";
import { GridMode } from "../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "../../src/lib/shared/pictograph/prop/domain/enums/PropType";

// Default settings for Node.js (no Svelte state dependency)
const DEFAULT_NODE_SETTINGS = {
  leftPropType: PropType.STAFF,
  rightPropType: PropType.STAFF,
};

/**
 * Node.js-compatible PictographPreparer
 * Does not depend on Svelte state management
 */
export class NodePictographPreparer {
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
          return p as PreparedPictographData;
        }
      })
    );
  }

  async prepareSingle(
    pictograph: PictographData,
    options?: PrepareOptions
  ): Promise<PreparedPictographData> {
    const cacheKey = this.deriveCacheKey(pictograph, options);

    const cached = this.prepareCache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return { ...pictograph, _prepared: cached };
    }

    const pending = this.pendingPrepares.get(cacheKey);
    if (pending) {
      const prepared = await pending;
      return { ...pictograph, _prepared: prepared };
    }

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

  private deriveCacheKey(pictograph: PictographData, options?: PrepareOptions): string {
    const left = pictograph.motions?.left;
    const right = pictograph.motions?.right;

    // Use default settings for Node.js
    const globalSettings = DEFAULT_NODE_SETTINGS;

    const parts = [
      left?.motionType ?? "none",
      left?.startLocation ?? "",
      left?.endLocation ?? "",
      left?.rotationDirection ?? "",
      left?.turns ?? 0,
      options?.leftPropType ?? globalSettings.leftPropType ?? left?.propType ?? "",
      left?.arrowPlacementData?.manualAdjustmentX ?? 0,
      left?.arrowPlacementData?.manualAdjustmentY ?? 0,
      right?.motionType ?? "none",
      right?.startLocation ?? "",
      right?.endLocation ?? "",
      right?.rotationDirection ?? "",
      right?.turns ?? 0,
      options?.rightPropType ?? globalSettings.rightPropType ?? right?.propType ?? "",
      right?.arrowPlacementData?.manualAdjustmentX ?? 0,
      right?.arrowPlacementData?.manualAdjustmentY ?? 0,
      options?.themeMode ?? "dark",
    ];

    return parts.join("|");
  }

  private deriveGridMode(pictograph: PictographData): GridMode {
    if (pictograph.gridMode) {
      return pictograph.gridMode;
    }

    if (!pictograph.motions?.left || !pictograph.motions?.right) {
      return GridMode.DIAMOND;
    }
    try {
      return this.gridModeDeriver.deriveGridMode(
        pictograph.motions.left,
        pictograph.motions.right
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
    const settings = DEFAULT_NODE_SETTINGS;

    const motions = this.getMotionsWithOverrides(pictograph, settings, options);

    await Promise.all(
      motions.map(async ([color, motion]) => {
        try {
          if (!motion.propPlacementData) return;

          const [renderData, placementData] = await Promise.all([
            this.propLoader.loadPropSvg(
              motion.propPlacementData,
              motion,
              false,
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
    settings: { leftPropType?: PropType; rightPropType?: PropType },
    options?: PrepareOptions
  ): [string, MotionData][] {
    return Object.entries(pictograph.motions || {})
      .filter((entry): entry is [string, MotionData] => entry[1] !== undefined)
      .map(([color, motion]) => {
        if (motion.propType === PropType.HAND) {
          return [color, motion] as [string, MotionData];
        }

        const explicitPropType =
          color === "blue" ? options?.leftPropType : options?.rightPropType;
        if (explicitPropType !== undefined) {
          return [color, { ...motion, propType: explicitPropType }] as [
            string,
            MotionData,
          ];
        }

        const settingsPropType =
          color === "blue" ? settings.leftPropType : settings.rightPropType;
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
