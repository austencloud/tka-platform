/**
 * Promo Generator Service Type Identifiers
 *
 * Services for generating 3D device mockup promotional videos.
 */

export const PromoTypes = {
  // Core Services
  IPromoOrchestrator: Symbol.for("IPromoOrchestrator"),
  IPromoSceneManager: Symbol.for("IPromoSceneManager"),
  IScreenshotInjector: Symbol.for("IScreenshotInjector"),
  IPromoAnimationController: Symbol.for("IPromoAnimationController"),
  IPromoVideoExporter: Symbol.for("IPromoVideoExporter"),
} as const;
