/**
 * PictographPreparer - Batch prepares pictographs with positions
 *
 * Single responsibility: Calculate arrow/prop positions for pictographs.
 * Used before rendering to eliminate per-component async calculations.
 *
 * This is the SINGLE SOURCE OF TRUTH for position calculations.
 * Uses PictographConfig for settings instead of scribe's global getSettings().
 */

import type { PictographData, MotionData, PropType } from "@tka/types";
import { GridMode } from "@tka/types";
import type {
  PreparedPictographData,
  PreparedRenderData,
} from "../../../domain/PreparedPictographData";
import type { PropPosition } from "../../../domain/PropPosition";
import type { PropAssets } from "../../../domain/PropAssets";
import type { IPictographPreparer, PrepareOptions } from "../contracts/IPictographPreparer";
import type { IArrowLifecycleManager } from "../../arrow/orchestration/contracts/IArrowLifecycleManager";
import type { IPropSvgLoader } from "../../prop/contracts/IPropSvgLoader";
import type { IPropPlacer } from "../../prop/contracts/IPropPlacer";
import type { IGridModeDeriver } from "../../grid/contracts/IGridModeDeriver";
import type { PictographConfig } from "../../../config/PictographConfig";

export class PictographPreparer implements IPictographPreparer {
  private prepareCache = new Map<string, PreparedRenderData>();
  private pendingPrepares = new Map<string, Promise<PreparedRenderData>>();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private arrowManager: IArrowLifecycleManager,
    private propLoader: IPropSvgLoader,
    private propPlacer: IPropPlacer,
    private gridModeDeriver: IGridModeDeriver,
    private config?: PictographConfig
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

  private deriveCacheKey(
    pictograph: PictographData,
    options?: PrepareOptions
  ): string {
    const blue = pictograph.motions?.blue;
    const red = pictograph.motions?.red;

    const bluePropType = options?.bluePropType ?? this.config?.getBluePropType() ?? "";
    const redPropType = options?.redPropType ?? this.config?.getRedPropType() ?? "";

    const parts = [
      blue?.motionType ?? "none",
      blue?.startLocation ?? "",
      blue?.endLocation ?? "",
      blue?.rotationDirection ?? "",
      blue?.turns ?? 0,
      blue?.startOrientation ?? "",
      blue?.endOrientation ?? "",
      bluePropType,
      blue?.arrowPlacementData?.manualAdjustmentX ?? 0,
      blue?.arrowPlacementData?.manualAdjustmentY ?? 0,
      red?.motionType ?? "none",
      red?.startLocation ?? "",
      red?.endLocation ?? "",
      red?.rotationDirection ?? "",
      red?.turns ?? 0,
      red?.startOrientation ?? "",
      red?.endOrientation ?? "",
      redPropType,
      red?.arrowPlacementData?.manualAdjustmentX ?? 0,
      red?.arrowPlacementData?.manualAdjustmentY ?? 0,
      options?.themeMode ?? "dark",
      (options?.useGridVersion ?? true) ? "grid" : "thumbnail",
    ];

    return parts.join("|");
  }

  private deriveGridMode(pictograph: PictographData): GridMode {
    if (pictograph.gridMode) {
      return pictograph.gridMode;
    }

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

    const motions = this.getMotionsWithOverrides(pictograph, options);

    await Promise.all(
      motions.map(async ([color, motion]) => {
        try {
          if (!motion.propPlacementData) return;

          const [renderData, placementData] = await Promise.all([
            this.propLoader.loadPropSvg(
              motion.propPlacementData,
              motion,
              options?.useGridVersion ?? true,
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
    options?: PrepareOptions
  ): [string, MotionData][] {
    const bluePropType = this.config?.getBluePropType();
    const redPropType = this.config?.getRedPropType();

    return Object.entries(pictograph.motions || {})
      .filter((entry): entry is [string, MotionData] => entry[1] !== undefined)
      .map(([color, motion]) => {
        if (motion.propType === "hand") {
          return [color, motion] as [string, MotionData];
        }

        const explicitPropType =
          color === "blue" ? options?.bluePropType : options?.redPropType;
        if (explicitPropType !== undefined) {
          return [color, { ...motion, propType: explicitPropType }] as [
            string,
            MotionData,
          ];
        }

        const settingsPropType =
          color === "blue" ? bluePropType : redPropType;
        if (settingsPropType) {
          return [color, { ...motion, propType: settingsPropType }] as [
            string,
            MotionData,
          ];
        }
        return [color, motion] as [string, MotionData];
      });
  }

  clearCache(): void {
    this.prepareCache.clear();
    this.pendingPrepares.clear();
  }
}
