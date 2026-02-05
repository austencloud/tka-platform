/**
 * Pictograph Prop State
 *
 * Manages prop positioning, assets, and lifecycle with user-selected prop types.
 * Independent sub-state - no dependencies on arrow state.
 */

import type { PictographData } from "../../domain/models/PictographData";
import type { MotionData } from "../../domain/models/MotionData";
import type { PropType } from "../../../prop/domain/enums/PropType";
import type { PropAssets } from "../../../prop/domain/models/PropAssets";
import type { PropPosition } from "../../../prop/domain/models/PropPosition";
import type { IPropPlacer } from "../../../prop/services/contracts/IPropPlacer";
import type { IPropSvgLoader } from "../../../prop/services/contracts/IPropSvgLoader";
import type { IPropTypeConfigurator } from "../../../prop/services/contracts/IPropTypeConfigurator";

export interface PictographPropState {
  readonly propPositions: Record<string, PropPosition>;
  readonly propAssets: Record<string, PropAssets>;
  readonly showProps: boolean;
  calculatePropPositions(
    pictographData: PictographData | null,
    userPropType: string
  ): Promise<void>;
}

export function createPictographPropState(
  propSvgLoader: IPropSvgLoader,
  PropPlacer: IPropPlacer,
  propTypeConfigService: IPropTypeConfigurator,
  useAnimatedProps: boolean = false
): PictographPropState {
  // Prop positioning state
  let propPositions = $state<Record<string, PropPosition>>({});
  let propAssets = $state<Record<string, PropAssets>>({});
  let showProps = $state(false);

  async function calculatePropPositions(
    pictographData: PictographData | null,
    userPropType: string
  ): Promise<void> {
    if (!pictographData?.motions) {
      // Only clear if we don't have valid data - don't clear during transitions
      propPositions = {};
      propAssets = {};
      showProps = true;
      return;
    }

    try {
      const positions: Record<string, PropPosition> = {};
      const assets: Record<string, PropAssets> = {};
      const errors: Record<string, string> = {};

      // Use the prop type configuration service to map UI type to filename
      const propTypeFilename =
        propTypeConfigService.mapPropTypeToFilename(userPropType);

      // Use the service to create pictograph data with all props using user's selected type
      // This ensures beta offset logic sees the correct prop types
      const updatedPictographData =
        propTypeConfigService.applyPropTypeToPictographData(
          pictographData,
          userPropType
        );

      // Process all motions in parallel for better performance
      const motionPromises = Object.entries(pictographData.motions).map(
        async ([color, motionData]) => {
          try {
            if (!motionData) {
              throw new Error("Motion data is undefined");
            }
            if (!motionData.propPlacementData) {
              throw new Error("No prop placement data available");
            }

            // Override the prop type with the user's selected type from settings
            // This ensures all props render as the user's chosen type
            const motionDataWithUserProp: MotionData = {
              motionType: motionData.motionType,
              rotationDirection: motionData.rotationDirection,
              startLocation: motionData.startLocation,
              endLocation: motionData.endLocation,
              turns: motionData.turns,
              startOrientation: motionData.startOrientation,
              endOrientation: motionData.endOrientation,
              isVisible: motionData.isVisible,
              propType: propTypeFilename as PropType,
              arrowLocation: motionData.arrowLocation,
              color: motionData.color,
              gridMode: motionData.gridMode,
              arrowPlacementData: motionData.arrowPlacementData,
              propPlacementData: motionData.propPlacementData,
              ...(motionData.prefloatMotionType !== undefined && {
                prefloatMotionType: motionData.prefloatMotionType,
              }),
              ...(motionData.prefloatRotationDirection !== undefined && {
                prefloatRotationDirection: motionData.prefloatRotationDirection,
              }),
            };

            // Load assets and calculate position in parallel
            // IMPORTANT: Pass updatedPictographData so beta offset logic sees all props with user's type
            const [renderData, placementData] = await Promise.all([
              propSvgLoader.loadPropSvg(
                motionData.propPlacementData,
                motionDataWithUserProp,
                useAnimatedProps
              ),
              PropPlacer.calculatePlacement(
                updatedPictographData,
                motionDataWithUserProp
              ),
            ]);

            if (!renderData.svgData) {
              throw new Error("Failed to load prop SVG data");
            }

            // Transform to expected format
            const propAssetsData = {
              imageSrc: renderData.svgData.svgContent,
              viewBox: `${renderData.svgData.viewBox.width} ${renderData.svgData.viewBox.height}`,
              center: renderData.svgData.center,
            };

            const position = {
              x: placementData.positionX,
              y: placementData.positionY,
              rotation: placementData.rotationAngle,
            };

            positions[color] = position;
            assets[color] = propAssetsData;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            errors[color] = errorMessage;
          }
        }
      );

      await Promise.all(motionPromises);

      // Only update state after async loading completes - keeps old data visible during transitions
      propPositions = positions;
      propAssets = assets;
      showProps =
        Object.keys(errors).length === 0 && Object.keys(positions).length > 0;

      // Log any errors
      if (Object.keys(errors).length > 0) {
        console.warn("⚠️ Prop lifecycle had errors:", errors);
      }
    } catch (error) {
      console.error("❌ Prop lifecycle coordination failed:", error);
      // Only clear on error - keeps old data visible if loading fails
      propPositions = {};
      propAssets = {};
      showProps = false;
    }
  }

  return {
    get propPositions() {
      return propPositions;
    },
    get propAssets() {
      return propAssets;
    },
    get showProps() {
      return showProps;
    },
    calculatePropPositions,
  };
}
