/**
 * Lab Module DI Container
 *
 * Services for the Lab module's experiments (screenshot capture, etc.)
 */

import { createContainer } from "iti";
import { ScreenshotOrchestrator } from "$lib/features/lab/services/implementations/ScreenshotOrchestrator";
import { ScreenshotUploader } from "$lib/features/lab/services/implementations/ScreenshotUploader";
import { ScreenshotLoader } from "$lib/features/lab/services/implementations/ScreenshotLoader";
import { ScreenshotTagController } from "$lib/features/lab/services/implementations/ScreenshotTagController";

export const labContainer = createContainer().add({
  screenshotOrchestrator: () => new ScreenshotOrchestrator(),
  screenshotUploader: () => new ScreenshotUploader(),
  screenshotLoader: () => new ScreenshotLoader(),
  screenshotTagController: () => new ScreenshotTagController(),
});
