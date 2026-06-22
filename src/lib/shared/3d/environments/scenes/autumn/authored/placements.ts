export interface RingConfig {
  count: number;
  radius: number;
  radiusJitter: number;
  scaleBase: number;
  scaleVariation: number;
  seed: number;
}

export interface Placement {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}

export function ringPlacements(cfg: RingConfig): Placement[] {
  return Array.from({ length: cfg.count }, (_, i) => {
    const angle = (i / cfg.count) * Math.PI * 2 + cfg.seed * 0.4;
    const s = cfg.seed * 100 + i;
    const r = cfg.radius + Math.sin(s * 3.7) * cfg.radiusJitter;
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      scale: cfg.scaleBase + Math.abs(Math.sin(s * 2.3) * cfg.scaleVariation),
      rotationY: angle + Math.PI + Math.sin(s * 1.7) * 0.3,
    };
  });
}
