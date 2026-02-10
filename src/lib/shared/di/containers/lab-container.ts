/**
 * Lab Module DI Container
 *
 * Services for the Lab module's experiments (screenshot capture, etc.)
 */

import { createContainer } from "iti";
import { ScreenshotOrchestrator } from "$lib/features/lab/services/implementations/ScreenshotOrchestrator";

export const labContainer = createContainer().add({
  screenshotOrchestrator: () => new ScreenshotOrchestrator(),
});
