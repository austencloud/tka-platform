/**
 * Per-court environment identity for The Cinder Court.
 *
 * The Gate 2 graybox authored every court as its own addressable mesh
 * (FF_Court_*, FF_PerformerPad_*, FF_Trench_*, FF_Orbit_*, FF_TorchStem_*),
 * which means the three courts can be three different environments at runtime
 * without touching the digest-locked GLB.
 *
 * The through-line is one volcano read vertically, not three unrelated rooms:
 *
 *   DJ  the magma chamber  - you are inside the mountain, at the source
 *   EK  the burn           - where that heat reaches fuel and becomes flame
 *   FL  the eruption column - where the ash plume generates its own lightning
 *
 * Volcanic lightning is a real phenomenon, which is what keeps the third court
 * from reading as a genre swerve: it is what a volcano does at the top.
 */

export interface FirstFireCourtIdentity {
  id: string;
  /** Registry effect id carried by that court's performer props. */
  effectId: string;
  /** Court floor: the walked stone. Near-black in every court. */
  floorColor: string;
  /** The performer's pad. Must never outread the performer standing on it. */
  padColor: string;
  /**
   * The channel ringing the court. FF_Trench_* is a flat 6.8m disc sitting
   * flush at y=0.08, not a recessed cut, so it cannot carry a molten read on
   * its own: pushed bright it becomes a saturated untextured donut and the
   * largest shape in the frame. It stays a dim warm rim, and the actual lava
   * geometry supplies the texture.
   */
  trenchColor: string;
  trenchEmissiveIntensity: number;
  /** Key light thrown by that court's own element. */
  keyColor: string;
  keyIntensity: number;
  keyHeight: number;
}

/**
 * Basalt is the one constant. Every court is cut from the same near-black
 * rock, so the element - not the geometry - is what changes between them.
 */
export const FIRST_FIRE_BASALT_COLOR = "#141010";

export const FIRST_FIRE_COURT_IDENTITIES: readonly FirstFireCourtIdentity[] = [
  {
    id: "dj",
    effectId: "charcoal",
    // The magma chamber. Light comes up off the floor, deep and red, and the
    // pad is the darkest thing in the court so the performer reads against it.
    floorColor: "#1b1110",
    padColor: "#0d0908",
    trenchColor: "#ff5312",
    trenchEmissiveIntensity: 0.35,
    keyColor: "#ff4a12",
    // A strong key close to the floor blows the court into one flat disc and
    // lets the raised plinth shade its own centre. The court is lit by its
    // trench, pool and torches; this key only keeps the performer readable.
    keyIntensity: 6.5,
    keyHeight: 2.4,
  },
  {
    id: "ek",
    effectId: "fire",
    // The burn. Rock is soot-blackened, light is higher and yellow-white,
    // thrown by open flame rather than by molten stone underfoot.
    floorColor: "#161010",
    padColor: "#0b0807",
    trenchColor: "#ff8a1e",
    trenchEmissiveIntensity: 0.32,
    keyColor: "#ffa53a",
    keyIntensity: 7.5,
    keyHeight: 3.1,
  },
  {
    id: "fl",
    effectId: "zap",
    // The eruption column. The rock is glassed where strikes landed, the
    // channel runs cold, and the key light is violet-white from above.
    floorColor: "#121216",
    padColor: "#08080b",
    trenchColor: "#b9a6ff",
    trenchEmissiveIntensity: 0.28,
    keyColor: "#cdbcff",
    keyIntensity: 9,
    keyHeight: 4.4,
  },
];

export function firstFireCourtIdentity(
  courtId: string | null | undefined
): FirstFireCourtIdentity | null {
  if (!courtId) return null;
  return (
    FIRST_FIRE_COURT_IDENTITIES.find((entry) => entry.id === courtId) ?? null
  );
}

/**
 * Which court a graybox mesh belongs to, or null for shared room shell.
 * Mesh names come from the Gate 2 Blender contract and are stable evidence.
 */
export function firstFireCourtOfMesh(meshName: string): string | null {
  const match = /^FF_(?:Court|PerformerPad|Trench|Orbit|TorchStem)_(dj|ek|fl)\b/i.exec(
    meshName
  );
  return match ? match[1]!.toLowerCase() : null;
}
