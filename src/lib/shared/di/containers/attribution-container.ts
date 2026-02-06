/**
 * Attribution Container
 *
 * DI container for attribution tracking services.
 * Captures how users discover and arrive at the app.
 */

import { createContainer } from "iti";
import { AttributionCapture } from "$lib/shared/attribution/services/implementations/AttributionCapture";
import { AttributionPersister } from "$lib/shared/attribution/services/implementations/AttributionPersister";
import { AttributionPromptTrigger } from "$lib/shared/attribution/services/implementations/AttributionPromptTrigger";

/**
 * Creates the attribution container with all attribution tracking services.
 */
export function createAttributionContainer() {
  return createContainer()
    .add({
      attributionCapture: () => new AttributionCapture(),
      attributionPromptTrigger: () => new AttributionPromptTrigger(),
    })
    .add((ctx) => ({
      attributionPersister: () =>
        new AttributionPersister(ctx.attributionCapture),
    }));
}

// Export type for type inference
export type AttributionContainer = ReturnType<typeof createAttributionContainer>;
