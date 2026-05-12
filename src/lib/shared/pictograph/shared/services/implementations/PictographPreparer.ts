import type { PictographData } from "../../domain/models/PictographData";
import type { MotionData } from "../../domain/models/MotionData";
import type {
  PreparedPictographData,
  PreparedRenderData,
} from "../../domain/models/PreparedPictographData";
import type { PrepareOptions } from "../contracts/types";
import type { ArrowLifecycleManager } from "../../../arrow/orchestration/services/implementations/ArrowLifecycleManager";
import type { PropSvgLoader } from "../../../prop/services/implementations/PropSvgLoader";
import type { PropPlacer } from "../../../prop/services/implementations/PropPlacer";
import { deriveGridMode as _deriveGridMode } from "../../../grid/services/grid-mode-deriver";
import type { PropPosition } from "../../../prop/domain/models/PropPosition";
import type { PropAssets } from "../../../prop/domain/models/PropAssets";
import { GridMode } from "../../../grid/domain/enums/grid-enums";
import { PropType } from "../../../prop/domain/enums/PropType";
import { MotionType, HandPath, type Orientation } from "../../domain/enums/pictograph-enums";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";

export class PictographPreparer {
  private prepareCache = new Map<string, PreparedRenderData>();
  private pendingPrepares = new Map<string, Promise<PreparedRenderData>>();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private arrowManager: ArrowLifecycleManager,
    private propLoader: PropSvgLoader,
    private propPlacer: PropPlacer
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

    const effectivePictograph = options?.handPathMode
      ? this.transformForHandPath(pictograph)
      : pictograph;

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

  private deriveCacheKey(pictograph: PictographData, options?: PrepareOptions): string {
    const blue = pictograph.motions?.blue;
    const red = pictograph.motions?.red;

    const globalSettings = getSettings();

    const parts = [
      pictograph.letter ?? "none",
      blue?.motionType ?? "none",
      blue?.startLocation ?? "",
      blue?.endLocation ?? "",
      blue?.rotationDirection ?? "",
      blue?.turns ?? 0,
      blue?.startOrientation ?? "",
      blue?.endOrientation ?? "",
      options?.bluePropType ?? globalSettings.bluePropType ?? "",
      blue?.arrowPlacementData?.manualAdjustmentX ?? 0,
      blue?.arrowPlacementData?.manualAdjustmentY ?? 0,
      red?.motionType ?? "none",
      red?.startLocation ?? "",
      red?.endLocation ?? "",
      red?.rotationDirection ?? "",
      red?.turns ?? 0,
      red?.startOrientation ?? "",
      red?.endOrientation ?? "",
      options?.redPropType ?? globalSettings.redPropType ?? "",
      red?.arrowPlacementData?.manualAdjustmentX ?? 0,
      red?.arrowPlacementData?.manualAdjustmentY ?? 0,
      options?.themeMode ?? "dark",
      (options?.useGridVersion ?? false) ? "grid" : "thumbnail",
      options?.handPathMode ? "hp" : "",
      options?.showBlueMotion === false ? "hideBlue" : "",
      options?.showRedMotion === false ? "hideRed" : "",
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
      return _deriveGridMode(
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
    const globalSettings = getSettings();
    const settings = {
      bluePropType: globalSettings.bluePropType,
      redPropType: globalSettings.redPropType,
    };

    const motions = this.getMotionsWithOverrides(pictograph, settings, options);

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
    settings: { bluePropType?: unknown; redPropType?: unknown },
    options?: PrepareOptions
  ): [string, MotionData][] {
    return Object.entries(pictograph.motions || {})
      .filter((entry): entry is [string, MotionData] => entry[1] !== undefined)
      .map(([color, motion]) => {
        if (motion.propType === PropType.HAND) {
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
        startOrientation: undefined as unknown as Orientation,
        endOrientation: undefined as unknown as Orientation,
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

  clearCache(): void {
    this.prepareCache.clear();
    this.pendingPrepares.clear();
  }
}

import { arrowLifecycleManager } from "../../../arrow/orchestration/services/implementations/ArrowLifecycleManager";
import { propSvgLoader } from "../../../prop/services/implementations/PropSvgLoader";
import { propPlacer } from "../../../prop/services/implementations/PropPlacer";

export const pictographPreparer = new PictographPreparer(
  arrowLifecycleManager,
  propSvgLoader,
  propPlacer
);
