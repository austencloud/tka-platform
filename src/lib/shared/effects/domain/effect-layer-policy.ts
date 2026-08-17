/** Semantic layer intent. Renderers resolve this to their platform z-index. */
export type EffectLayerMode = "behind" | "front";

/**
 * Fire envelops the prop by default, and LED *is* the prop — a capsule's
 * endpoint lamps and a pixel staff's strip both sit on the surface facing the
 * viewer, so drawing them behind the prop art hid the whole effect and left
 * only the few pixels that overhung the ends. Other effects retain the
 * historical behind-prop presentation unless their own material calls for a
 * front layer.
 */
const FRONT_BY_DEFAULT: ReadonlySet<string> = new Set(["fire", "led"]);

export function getDefaultEffectLayer(effectId: string): EffectLayerMode {
  return FRONT_BY_DEFAULT.has(effectId) ? "front" : "behind";
}
