/**
 * Promo Generator Module
 *
 * Dependency injection bindings for the 3D device mockup promo video generator.
 */

import { ContainerModule, type ContainerModuleLoadOptions } from "inversify";
import { createHMRSafeBinder } from "../hmr/safeBind";
import { TYPES } from "../types";

// Service implementations
import { PromoSceneManager } from "../../../features/promo-generator/services/implementations/PromoSceneManager";
import { ScreenshotInjector } from "../../../features/promo-generator/services/implementations/ScreenshotInjector";
import { PromoAnimationController } from "../../../features/promo-generator/services/implementations/PromoAnimationController";
import { PromoVideoExporter } from "../../../features/promo-generator/services/implementations/PromoVideoExporter";
import { PromoOrchestrator } from "../../../features/promo-generator/services/implementations/PromoOrchestrator";

export const promoModule = new ContainerModule(
  (options: ContainerModuleLoadOptions) => {
    const bind = createHMRSafeBinder(options);

    // === Core Services ===
    bind(TYPES.IPromoSceneManager).to(PromoSceneManager).inSingletonScope();
    bind(TYPES.IScreenshotInjector).to(ScreenshotInjector).inSingletonScope();
    bind(TYPES.IPromoAnimationController)
      .to(PromoAnimationController)
      .inSingletonScope();
    bind(TYPES.IPromoVideoExporter).to(PromoVideoExporter).inSingletonScope();
    bind(TYPES.IPromoOrchestrator).to(PromoOrchestrator).inSingletonScope();
  }
);
