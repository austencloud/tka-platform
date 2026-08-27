/**
 * Co-exported types from retired interface contracts.
 */



export interface CoralSceneConfig {
  /** Total number of coral pieces to place (default 20) */
  totalCount?: number;
  /** Distribution per layer: [back, mid, front] (default [6, 8, 6]) */
  layerCounts?: [number, number, number];
}


export interface CosmicLayers {
  stars: boolean;
  nebula: boolean;
  aurora: boolean;
  milkyWay: boolean;
  meteors: boolean;
  comets: boolean;
  ufo: boolean;
}


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


export interface UFOStatusSnapshot {
  active: boolean;
  mood: string | null;
  tiredness: number | null;
  state: string | null;
  position: { x: number; y: number } | null;
  heading: number | null;
  scannedStars: number;
}


export interface CosmicLayers {
  stars: boolean;
  nebula: boolean;
  aurora: boolean;
  milkyWay: boolean;
  meteors: boolean;
  comets: boolean;
  ufo: boolean;
}


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


export interface UFOStatusSnapshot {
  active: boolean;
  mood: string | null;
  tiredness: number | null;
  state: string | null;
  position: { x: number; y: number } | null;
  heading: number | null;
  scannedStars: number;
}
