export interface Ghost2DAgeVisual {
  bodyAlpha: number;
  rimAlpha: number;
  frostAlpha: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Resolve the 2D Chrono-Frost age story without coupling it to canvas state.
 * Fresh exposures retain a glass body, the middle sheds into frost, and the
 * oldest readable phase is carried by the pale rim before everything reaches
 * zero at the persistence boundary.
 */
export function resolveGhost2DAgeVisual(
  ageSeconds: number,
  lifetimeSeconds: number,
  intensity: number
): Ghost2DAgeVisual {
  const age = clamp01(ageSeconds / Math.max(0.001, lifetimeSeconds));
  const strength = clamp01(intensity);
  const remaining = Math.pow(1 - age, 0.72);
  const bodyShedding = smoothstep((age - 0.14) / 0.48);
  const frostPhase = Math.sin(Math.PI * clamp01((age - 0.04) / 0.82));

  return {
    bodyAlpha: 0.54 * strength * (1 - bodyShedding) * Math.pow(1 - age, 1.15),
    rimAlpha: 0.74 * strength * remaining,
    frostAlpha: 0.34 * strength * Math.max(0, frostPhase) * remaining,
  };
}

/** Blue/red separation belongs to Ghost intent, not to the live prop sprite. */
export function resolveGhostPropColor(
  propId: number,
  blueColor: string,
  redColor: string
): string {
  return propId % 2 === 0 ? blueColor : redColor;
}

function parseHexColor(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Mix the Ghost hue toward cold white for the cached ice-rim treatment. */
export function resolveGhostRimColor(color: string): string {
  const source = parseHexColor(color);
  const coldWhite: [number, number, number] = [226, 249, 255];
  if (!source) return "#e2f9ff";

  const amount = 0.68;
  const channels = source.map((channel, index) =>
    Math.round(channel + (coldWhite[index] - channel) * amount)
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
