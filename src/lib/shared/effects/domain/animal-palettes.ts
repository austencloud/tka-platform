import type { AnimalIntent } from "./effects-config";
import { resolvePaletteByIntent, type SilkPalette } from "./silk-palettes";

export type AnimalPalette = SilkPalette;

export function resolveAnimalPalette(intent: AnimalIntent): AnimalPalette {
  return resolvePaletteByIntent(intent);
}
