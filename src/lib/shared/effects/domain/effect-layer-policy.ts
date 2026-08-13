/** Semantic layer intent. Renderers resolve this to their platform z-index. */
export type EffectLayerMode = "behind" | "front";

/**
 * Fire envelops the prop by default. Other effects retain the historical
 * behind-prop presentation unless their own material calls for a front layer.
 */
const FRONT_BY_DEFAULT: ReadonlySet<string> = new Set(["fire"]);

export function getDefaultEffectLayer(effectId: string): EffectLayerMode {
  return FRONT_BY_DEFAULT.has(effectId) ? "front" : "behind";
}
