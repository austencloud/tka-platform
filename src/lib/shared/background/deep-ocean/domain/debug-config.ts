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
  enableInteractions: boolean;  // false = no fish-to-fish micro-interactions
  enableRareBehaviors: boolean; // false = no barrel rolls, freezes, sync swims
  enableHomeZones: boolean;     // false = no home zone drift preference
  enableHunting: boolean;       // false = no predator/prey chase sequences
  showHomeZones: boolean;       // true = draw home zone debug circles
  showInteractions: boolean;    // true = flash when interactions occur
  showHunts: boolean;           // true = draw hunt lines and state labels
}

// Global mutable debug state
export const fishDebugConfig: FishDebugConfig = {
  useSpineRendering: true,
  enableWobble: true,
  enableTailOscillation: true,
  enablePropulsion: true,
  enableFlocking: true,
  enableInteractions: true,
  enableRareBehaviors: true,
  enableHomeZones: true,
  enableHunting: true,
  showHomeZones: false,
  showInteractions: false,
  showHunts: false,
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).fishDebugConfig = fishDebugConfig;
}
