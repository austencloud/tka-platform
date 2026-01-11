export interface Firefly {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  glowRadius: number;
  glowIntensity: number;
  blinkPhase: number;
  blinkCycleLength: number;
  color: { r: number; g: number; b: number };
  wanderAngle: number;
  wanderSpeed: number;
  baseOpacity: number;
  isSpecial: boolean; // Easter egg: rare rose-colored firefly
  depth: number; // 0 = far (behind trees), 1 = near (in front)
}
