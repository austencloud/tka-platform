/**
 * Compatibility exports for Fire callers. Shared fluid shaders now live under
 * the fluid service; Fire-specific combustion and presentation programs remain
 * exported from that module until their renderer contract is split further.
 */
export * from "../fluid/fluid-shader-sources";
