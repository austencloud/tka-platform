import type { DirectorEasing } from "./film-director-schema";

export function applyDirectorEasing(
  value: number,
  easing: DirectorEasing
): number {
  switch (easing) {
    case "linear":
      return value;
    case "ease-in":
      return value * value;
    case "ease-out":
      return 1 - (1 - value) * (1 - value);
    case "ease-in-out":
      return value < 0.5
        ? 2 * value * value
        : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }
}
