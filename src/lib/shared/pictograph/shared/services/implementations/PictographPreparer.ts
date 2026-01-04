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

import { injectable, inject } from "inversify";
import { TYPES } from "../../../../inversify/types";
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

@injectable()
export class PictographPreparer implements IPictographPreparer {
  constructor(
    @inject(TYPES.IArrowLifecycleManager)
    private arrowManager: IArrowLifecycleManager,
    @inject(TYPES.IPropSvgLoader) private propLoader: IPropSvgLoader,
    @inject(TYPES.IPropPlacer) private propPlacer: IPropPlacer,
    @inject(TYPES.IGridModeDeriver) private gridModeDeriver: IGridModeDeriver
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

    const prepared: PreparedRenderData = {
      gridMode,
      arrowPositions: arrowResult.positions,
      arrowAssets: arrowResult.assets,
      arrowMirroring: arrowResult.mirroring,
      propPositions,
      propAssets,
    };

    return {
      ...pictograph,
      _prepared: prepared,
    };
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

    const motions = this.getMotionsWithOverrides(pictograph, settings);

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
    settings: ReturnType<typeof getSettings>
  ): [string, MotionData][] {
    return Object.entries(pictograph.motions || {})
      .filter((entry): entry is [string, MotionData] => entry[1] !== undefined)
      .map(([color, motion]) => {
        // If motion explicitly uses HAND (e.g., Assembly mode), don't override
        if (motion.propType === PropType.HAND) {
          return [color, motion] as [string, MotionData];
        }

        // Otherwise, apply settings override if available
        const override =
          color === "blue" ? settings.bluePropType : settings.redPropType;
        if (override) {
          return [color, { ...motion, propType: override }] as [
            string,
            MotionData,
          ];
        }
        return [color, motion] as [string, MotionData];
      });
  }
}
