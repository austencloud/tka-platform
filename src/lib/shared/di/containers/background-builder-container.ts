/**
 * Background Builder Container - ITI-based dependency injection
 *
 * Services for the background builder/lab module.
 */

import { createContainer } from "iti";
import { TreeLabRenderer } from "../../../features/background-builder/services/implementations/TreeLabRenderer";
import { TreeFeedbackPersister } from "../../../features/background-builder/services/implementations/TreeFeedbackPersister";
import { PreviewAnimationController } from "../../../features/background-builder/services/implementations/PreviewAnimationController";
import { NightSkyLabController } from "../../../features/background-builder/services/implementations/NightSkyLabController";
import { UFOStatusPoller } from "../../../features/background-builder/services/implementations/UFOStatusPoller";

/**
 * Background builder container with lab services
 */
export const backgroundBuilderContainer = createContainer().add({
  treeLabRenderer: () => new TreeLabRenderer(),
  treeFeedbackPersister: () => new TreeFeedbackPersister(),
  previewAnimationController: () => new PreviewAnimationController(),
  nightSkyLabController: () => new NightSkyLabController(),
  ufoStatusPoller: () => new UFOStatusPoller(),
});

export type BackgroundBuilderContainerType = typeof backgroundBuilderContainer;
