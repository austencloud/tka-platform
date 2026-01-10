/**
 * Promo Generator ITI Container
 *
 * Provides services for 3D device mockup promo video generation.
 * All promo services are singletons within this container.
 */

import { createContainer } from "iti";
import { PromoSceneManager } from "$lib/features/promo-generator/services/implementations/PromoSceneManager";
import { ScreenshotInjector } from "$lib/features/promo-generator/services/implementations/ScreenshotInjector";
import { PromoAnimationController } from "$lib/features/promo-generator/services/implementations/PromoAnimationController";
import { PromoVideoExporter } from "$lib/features/promo-generator/services/implementations/PromoVideoExporter";
import { PromoOrchestrator } from "$lib/features/promo-generator/services/implementations/PromoOrchestrator";

/**
 * Creates the promo container with all promo generator services.
 * No external dependencies required.
 */
export function createPromoContainer() {
  return createContainer()
    // === Tier 1: Core services with no dependencies ===
    .add({
      promoSceneManager: () => new PromoSceneManager(),
      screenshotInjector: () => new ScreenshotInjector(),
      promoAnimationController: () => new PromoAnimationController(),
      promoVideoExporter: () => new PromoVideoExporter(),
    })
    // === Tier 2: Orchestrator depends on all Tier 1 services ===
    .add((ctx) => ({
      promoOrchestrator: () =>
        new PromoOrchestrator(
          ctx.promoSceneManager,
          ctx.screenshotInjector,
          ctx.promoAnimationController,
          ctx.promoVideoExporter
        ),
    }));
}

export type PromoContainer = ReturnType<typeof createPromoContainer>;
