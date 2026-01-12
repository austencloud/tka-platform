/**
 * Fish Debug Configuration
 *
 * Global toggles for isolating the fish spazzing bug.
 * Can be modified at runtime via window.fishDebug in the console.
 */

export interface FishDebugConfig {
  useSpineRendering: boolean;   // false = use legacy static bezier rendering
  enableWobble: boolean;        // false = disable wobble transforms in renderer
  enableTailOscillation: boolean; // false = no tail wave animation
  enablePropulsion: boolean;    // false = constant speed, no thrust variation
  enableFlocking: boolean;      // false = no schooling forces
}

// Global mutable debug state
export const fishDebugConfig: FishDebugConfig = {
  useSpineRendering: true,
  enableWobble: true,
  enableTailOscillation: true,
  enablePropulsion: true,
  enableFlocking: true,
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).fishDebugConfig = fishDebugConfig;
}
