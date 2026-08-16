/**
 * Per-look copy, keyed by preset id across every effect.
 *
 * The generic `preview.trait` describes the effect, not the look, so all four
 * Fire presets rendered as "Live flame · 75% intensity" - four identical lines
 * under four visibly different tiles. Copy lives here so adding an effect is a
 * new block in this map rather than another branch in EffectPresetsSection.
 *
 * Describe the visible result, never the parameter values behind it.
 */
const LOOK_DESCRIPTIONS: Readonly<Record<string, string>> = {
  // Bloom
  "bloom-supernova": "Sharp diffraction flare",
  "bloom-comet": "Long-exposure motion",
  "bloom-halo": "Soft photographic glow",

  // Fire
  "fire-classic": "Natural orange burn",
  "fire-blue-flame": "Cold gas-blue burn",
  "fire-spirit": "Violet ghost flame",
  "fire-liquid": "Flowing molten body",
};

/** Null when a look has no copy yet, so the caller can fall back to its trait. */
export function describeLook(presetId: string): string | null {
  return LOOK_DESCRIPTIONS[presetId] ?? null;
}
