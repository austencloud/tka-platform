export type LodBand = "hero" | "idle" | "frozen";

export interface LodStation {
  id: string;
  x: number;
  z: number;
}

export interface LodOptions {
  heroRadius: number;
  idleRadius: number;
  /** Extra distance a current-hero keeps its band before demotion. */
  hysteresis: number;
}

const DEFAULTS: LodOptions = { heroRadius: 12, idleRadius: 30, hysteresis: 4 };

/**
 * Classify each station by distance to the player, with hysteresis so a
 * station at a threshold does not thrash bands frame to frame.
 */
export function computeCovenLods(
  playerX: number,
  playerZ: number,
  stations: readonly LodStation[],
  prev: ReadonlyMap<string, LodBand>,
  options: Partial<LodOptions> = {},
): Map<string, LodBand> {
  const o = { ...DEFAULTS, ...options };
  const out = new Map<string, LodBand>();
  for (const s of stations) {
    const d = Math.hypot(s.x - playerX, s.z - playerZ);
    const wasHero = prev.get(s.id) === "hero";
    const wasIdle = prev.get(s.id) === "idle";
    const heroEdge = o.heroRadius + (wasHero ? o.hysteresis : 0);
    const idleEdge = o.idleRadius + (wasIdle || wasHero ? o.hysteresis : 0);
    out.set(s.id, d <= heroEdge ? "hero" : d <= idleEdge ? "idle" : "frozen");
  }
  return out;
}
