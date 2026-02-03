/**
 * Background Builder Container - ITI-based dependency injection
 *
 * Services for the background builder/lab module.
 */

import { createContainer } from "iti";
import { PreviewAnimationController } from "../../../features/background-builder/services/implementations/PreviewAnimationController";
import { NightSkyLabController } from "../../../features/background-builder/services/implementations/NightSkyLabController";
import { UFOStatusPoller } from "../../../features/background-builder/services/implementations/UFOStatusPoller";
import { CoralAssetLoader } from "../../../features/background-builder/services/implementations/CoralAssetLoader";
import { CoralSceneRenderer } from "../../../features/background-builder/services/implementations/CoralSceneRenderer";
import { DeepOceanBackgroundOrchestrator } from "@austencloud/backgrounds";

/**
 * Background builder container with lab services
 */
export const backgroundBuilderContainer = createContainer().add({
  previewAnimationController: () => new PreviewAnimationController(),
  nightSkyLabController: () => new NightSkyLabController(),
  ufoStatusPoller: () => new UFOStatusPoller(),
  deepOceanBackgroundSystem: () => DeepOceanBackgroundOrchestrator.create(),
  coralAssetLoader: () => new CoralAssetLoader(),
  coralSceneRenderer: () => new CoralSceneRenderer(new CoralAssetLoader()),
});

export type BackgroundBuilderContainerType = typeof backgroundBuilderContainer;
