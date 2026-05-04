import type { PersonalityComponent } from "../domain/village-types";

export function generatePersonality(mean: number, stdDev: number): PersonalityComponent {
  return {
    learnSpeed: clampedNormal(mean, stdDev),
    sociability: clampedNormal(mean, stdDev),
    creativity: clampedNormal(mean, stdDev),
    patience: clampedNormal(mean, stdDev),
    curiosity: clampedNormal(mean, stdDev),
    ego: 0,
  };
}

function clampedNormal(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.min(1, mean + z * stdDev));
}
