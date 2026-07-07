/**
 * Tunnel performer appearance — the "Performer Set" model.
 *
 * The tunnel overlays symmetry copies ("performers") of the open sequence. This
 * gives each performer its own per-hand prop. A `TunnelAppearance` is an ordered
 * list of {@link PerformerSkin}s the copies CYCLE through by arm index:
 *
 *   arm 0      = the center pair
 *   arm i + 1  = additional (overlaid) layer i
 *   skin       = skins[arm % skins.length]
 *
 * One skin = uniform (today's behavior; the default). Two skins = alternating
 * props around the ring — composes with the Invert/Echo/Speed alternate-arm
 * modulators for free. It is orthogonal to the symmetry {@link TunnelConfig}: a
 * mandala shape and an appearance are picked independently.
 *
 * Performer COLOR rides the existing spectrum fan (rainbow) or the base pair
 * (uniform) — explicit per-hand color is a later phase (see the design doc's
 * deferred section).
 */

/** One performer's costume: a prop per hand. */
export interface PerformerSkin {
  /** PropType value, e.g. "staff". */
  blueProp: string;
  redProp: string;
}

/** The whole cast: an ordered set of skins the copies cycle through. */
export type TunnelAppearance = PerformerSkin[];

export const DEFAULT_SKIN: PerformerSkin = { blueProp: "staff", redProp: "staff" };
export const DEFAULT_APPEARANCE: TunnelAppearance = [DEFAULT_SKIN];
export const MAX_SKINS = 8;

const PROP_FALLBACK = "staff";
const asProp = (v: unknown): string =>
  typeof v === "string" && v.length > 0 ? v : PROP_FALLBACK;

/** Which skin arm `armIndex` wears. Wraps; empty → the default skin. */
export function skinForArm(skins: TunnelAppearance, armIndex: number): PerformerSkin {
  if (skins.length === 0) return DEFAULT_SKIN;
  const i = ((armIndex % skins.length) + skins.length) % skins.length;
  return skins[i]!;
}

/**
 * The per-hand prop TYPE a copy (arm `armIndex`) carries into its render layer,
 * or `null` when it should inherit the viewer's global prop.
 *
 * While the cast is UNCUSTOMIZED, every copy inherits the global prop (null →
 * the render layer omits an explicit type and the engine falls back to the
 * current global prop) — exactly the center pair's rule. This keeps the copies
 * and the center consistent the instant a reset flips `customized` false, with
 * no dependency on the skin list being re-synced to the global prop first (the
 * reset-leaves-stale-copies bug). Once the user OWNS the cast, each copy wears
 * its performer skin.
 */
export function copyPropTypes(
  customized: boolean,
  skins: TunnelAppearance,
  armIndex: number,
): PerformerSkin | null {
  return customized ? skinForArm(skins, armIndex) : null;
}

/** Harden persisted / preset data into a valid non-empty skin list. */
export function coerceSkins(raw: unknown): TunnelAppearance {
  if (!Array.isArray(raw)) return [{ ...DEFAULT_SKIN }];
  const out = raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .slice(0, MAX_SKINS)
    .map((s) => ({ blueProp: asProp(s.blueProp), redProp: asProp(s.redProp) }));
  return out.length > 0 ? out : [{ ...DEFAULT_SKIN }];
}

export interface AppearancePreset {
  id: string;
  name: string;
  appearance: TunnelAppearance;
}

/** Built-in performer sets. Curated by eye; ids are stable (persistence key). */
export const APPEARANCE_PRESETS: AppearancePreset[] = [
  { id: "solo", name: "Solo", appearance: [{ blueProp: "staff", redProp: "staff" }] },
  {
    id: "duel",
    name: "Duel",
    appearance: [
      { blueProp: "staff", redProp: "staff" },
      { blueProp: "sword", redProp: "sword" },
    ],
  },
  {
    id: "troupe",
    name: "Troupe",
    appearance: [
      { blueProp: "staff", redProp: "staff" },
      { blueProp: "club", redProp: "club" },
      { blueProp: "fan", redProp: "fan" },
    ],
  },
  { id: "fans", name: "Fans", appearance: [{ blueProp: "fan", redProp: "fan" }] },
  { id: "hoops", name: "Hoops", appearance: [{ blueProp: "minihoop", redProp: "minihoop" }] },
];

/** Structural equality of two skin lists (preset-match highlight). */
export function skinsEqual(a: TunnelAppearance, b: TunnelAppearance): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.blueProp === b[i]!.blueProp && s.redProp === b[i]!.redProp);
}
