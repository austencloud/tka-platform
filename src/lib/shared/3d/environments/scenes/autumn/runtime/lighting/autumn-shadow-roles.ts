/**
 * Which authored Autumn objects take part in the shadow pass.
 *
 * Enabling shadows on a 380K-triangle environment is only affordable if the
 * caster set is deliberate. A caster costs a second depth rasterisation every
 * frame, so the list is limited to things whose silhouette actually lands
 * inside the clearing-sized shadow camera and reads at performance distance:
 * hero trees, saplings, logs, boulders, ferns, mushrooms and the owl.
 *
 * The distant tree belt is excluded on purpose. It sits 24-27m out, outside the
 * shadow camera entirely, so casting from it would pay the depth pass for
 * geometry that can never darken a visible pixel.
 *
 * Grass is excluded from BOTH roles here because AutumnWind owns those meshes
 * and already sets them to receive-only; claiming them twice would make the
 * winner depend on effect ordering.
 *
 * One consequence of the asset pipeline is worth knowing: the optimizer's
 * GPU-instancing pass collapses every repeated asset (ferns, saplings, the
 * fairy-ring mushrooms, birches, snags, the Poly Haven rocks) into unnamed
 * InstancedMesh batches. Those hit the receive-only default rather than the
 * caster list. That is the right outcome anyway - they are small understory and
 * far-belt geometry - but it does mean the caster prefixes below only ever
 * match the individually-named hero geometry that survives instancing.
 */

export interface AutumnShadowRole {
  cast: boolean;
  receive: boolean;
}

const NEITHER: AutumnShadowRole = { cast: false, receive: false };
const RECEIVE_ONLY: AutumnShadowRole = { cast: false, receive: true };
const CAST_AND_RECEIVE: AutumnShadowRole = { cast: true, receive: true };

/** Owned by AutumnWind, or too far out to reach the shadow camera. */
const EXCLUDED_PREFIXES = [
  "Autumn_Grass_",
  "DistantBirch",
  "DistantLarch",
  "DistantSnag",
  "DistantWillow",
];

/** Ground-ish surfaces that should catch contact darkening but never cast. */
const RECEIVER_PREFIXES = [
  "Autumn_Terrain",
  "MossPatch",
  "Packed_Performance_Clearing",
  "Pond_Sculpted_Basin",
  "Pond_Floating_Autumn_Leaves",
  "Autumn_Leaf_Drifts",
  "Autumn_Twig_Litter",
];

/** Standing geometry whose silhouette is worth a depth pass. */
const CASTER_PREFIXES = [
  "HeroTreeA",
  "HeroTreeB",
  "Sapling",
  "FallenLog",
  "Fern_",
  "Shore_Boulder",
  "Forest_Boulder",
  "FairyRing",
  "Autumn_Owl",
];

function hasPrefix(name: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => name.startsWith(prefix));
}

/**
 * Resolves the shadow role for one loaded mesh by its authored name.
 *
 * Unknown names receive but do not cast. That is the safe default: a stray
 * object picks up contact darkening from its neighbours without silently
 * adding another full-geometry depth pass.
 */
export function resolveAutumnShadowRole(name: string): AutumnShadowRole {
  if (!name) return RECEIVE_ONLY;
  if (hasPrefix(name, EXCLUDED_PREFIXES)) return NEITHER;
  if (hasPrefix(name, RECEIVER_PREFIXES)) return RECEIVE_ONLY;
  if (hasPrefix(name, CASTER_PREFIXES)) return CAST_AND_RECEIVE;
  return RECEIVE_ONLY;
}
