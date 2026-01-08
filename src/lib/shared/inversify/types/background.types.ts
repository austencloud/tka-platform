/**
 * Background Service Type Identifiers
 *
 * Services for rendering animated backgrounds (deep ocean, night sky, etc.).
 */

export const BackgroundTypes = {
  // Core Background
  IBackgroundManager: Symbol.for("IBackgroundManager"),
  IBackgroundRenderingService: Symbol.for("IBackgroundRenderingService"),
  IBackgroundPreloader: Symbol.for("IBackgroundPreloader"),
  IBackgroundConfigurationService: Symbol.for(
    "IBackgroundConfigurationService"
  ),
  IBackgroundSystem: Symbol.for("IBackgroundSystem"),

  // Night Sky
  INightSkyCalculationService: Symbol.for("INightSkyCalculationService"),

  // Deep Ocean - Physics & Systems
  IBubblePhysics: Symbol.for("IBubblePhysics"),
  IParticleSystem: Symbol.for("IParticleSystem"),
  ILightRayCalculator: Symbol.for("ILightRayCalculator"),

  // Deep Ocean - Animators
  IFishAnimator: Symbol.for("IFishAnimator"),
  IJellyfishAnimator: Symbol.for("IJellyfishAnimator"),

  // Deep Ocean - Renderers
  IGradientRenderer: Symbol.for("IGradientRenderer"),
  ILightRayRenderer: Symbol.for("ILightRayRenderer"),
  IBubbleRenderer: Symbol.for("IBubbleRenderer"),
  IParticleRenderer: Symbol.for("IParticleRenderer"),
  IFishRenderer: Symbol.for("IFishRenderer"),
  IJellyfishRenderer: Symbol.for("IJellyfishRenderer"),

  // Deep Ocean - Fish Rendering Services (decomposed from FishRenderer monolith)
  IColorCalculator: Symbol.for("IColorCalculator"),
  IFishEffectRenderer: Symbol.for("IFishEffectRenderer"),
  IFishFaceRenderer: Symbol.for("IFishFaceRenderer"),
  IFishFinRenderer: Symbol.for("IFishFinRenderer"),
  IFishPatternRenderer: Symbol.for("IFishPatternRenderer"),
  IFishBodyRenderer: Symbol.for("IFishBodyRenderer"),

  // @deprecated - use split services above
  IMarineLifeAnimator: Symbol.for("IMarineLifeAnimator"),
  IOceanRenderer: Symbol.for("IOceanRenderer"),
} as const;
