/**
 * Co-exported types from retired interface contracts.
 */


// === From ICoralSceneRenderer ===

export interface CoralSceneConfig {
  /** Total number of coral pieces to place (default 20) */
  totalCount?: number;
  /** Distribution per layer: [back, mid, front] (default [6, 8, 6]) */
  layerCounts?: [number, number, number];
}

// === From ICosmicLabController ===

export interface CosmicLayers {
  stars: boolean;
  nebula: boolean;
  aurora: boolean;
  milkyWay: boolean;
  meteors: boolean;
  comets: boolean;
  ufo: boolean;
}

// === From IPreviewAnimationController ===

export interface PreviewStats {
  fireflies: number;
  stars: number;
  ambientParticles: number;
  hasShootingStar: boolean;
}
export interface PlacementConfig {
  density: number;
  style: number;
}

// === From IUFOStatusPoller ===

export interface UFOStatusSnapshot {
  active: boolean;
  mood: string | null;
  tiredness: number | null;
  state: string | null;
  position: { x: number; y: number } | null;
  heading: number | null;
  scannedStars: number;
}

// === From ICosmicLabController ===

export interface CosmicLayers {
  stars: boolean;
  nebula: boolean;
  aurora: boolean;
  milkyWay: boolean;
  meteors: boolean;
  comets: boolean;
  ufo: boolean;
}

// === From IPreviewAnimationController ===

export interface PreviewStats {
  fireflies: number;
  stars: number;
  ambientParticles: number;
  hasShootingStar: boolean;
}

export interface PlacementConfig {
  density: number;
  style: number;
}

// === From IUFOStatusPoller ===

export interface UFOStatusSnapshot {
  active: boolean;
  mood: string | null;
  tiredness: number | null;
  state: string | null;
  position: { x: number; y: number } | null;
  heading: number | null;
  scannedStars: number;
}
