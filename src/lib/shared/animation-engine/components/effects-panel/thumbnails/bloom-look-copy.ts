const BLOOM_LOOK_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "bloom-supernova": "Sharp diffraction flare",
  "bloom-comet": "Long-exposure motion",
  "bloom-halo": "Soft photographic glow",
};

/** Bloom copy describes the visible result, not its internal parameter values. */
export function describeBloomLook(presetId: string): string | null {
  return BLOOM_LOOK_DESCRIPTIONS[presetId] ?? null;
}
