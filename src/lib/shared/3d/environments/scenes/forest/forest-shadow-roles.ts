export interface ForestShadowRole {
  cast: boolean;
  receive: boolean;
}

const NO_SHADOWS: ForestShadowRole = { cast: false, receive: false };
const RECEIVER_ONLY: ForestShadowRole = { cast: false, receive: true };
const CASTER_AND_RECEIVER: ForestShadowRole = { cast: true, receive: true };

/**
 * Keep the moon depth pass bounded. The 295-tree authored woodland remains out
 * of the shadow map; only terrain that can display stage and campsite contact
 * receives it. Their separate runtime owners decide which local meshes cast.
 */
export function resolveForestShadowRole(role: unknown): ForestShadowRole {
  return role === "terrain" || role === "camp-shelf"
    ? RECEIVER_ONLY
    : NO_SHADOWS;
}

/**
 * Optimized Poly Haven trees are multi-material meshes, so Three.js cannot
 * apply one alpha-tested depth override without leaking foliage-card geometry.
 * Their foliage material supplies orientation-aware indirect depth while the
 * four composition trees remain grounded as receivers. Rocks and deadwood cast
 * the clearing's local contact shadows without geometric islands.
 */
export function resolveForestNearFrameShadowRole(
  role: unknown,
  shadowsEnabled: boolean
): ForestShadowRole {
  if (!shadowsEnabled) return NO_SHADOWS;
  if (role === "near-frame-static-prop") return CASTER_AND_RECEIVER;
  return role === "near-frame-tree" || role === "near-frame-grass"
    ? RECEIVER_ONLY
    : NO_SHADOWS;
}
