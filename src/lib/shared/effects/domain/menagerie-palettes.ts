import type { MenagerieIntent } from "./effects-config";
import { resolvePaletteByIntent, type SilkPalette } from "./silk-palettes";

export type MenageriePalette = SilkPalette;

export function resolveMenageriePalette(intent: MenagerieIntent): MenageriePalette {
  return resolvePaletteByIntent(intent);
}
