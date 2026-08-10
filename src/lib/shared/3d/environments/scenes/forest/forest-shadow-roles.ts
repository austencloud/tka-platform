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
 * The four authored near-frame trees are the only woodland meshes allowed to
 * shape the clearing with directional shadows. Ground detail can receive the
 * result, while low/medium quality paths keep the entire near-frame layer out
 * of the depth pass.
 */
export function resolveForestNearFrameShadowRole(
  role: unknown,
  shadowsEnabled: boolean
): ForestShadowRole {
  if (!shadowsEnabled) return NO_SHADOWS;
  if (role === "near-frame-tree" || role === "near-frame-static-prop") {
    return CASTER_AND_RECEIVER;
  }
  return role === "near-frame-grass" ? RECEIVER_ONLY : NO_SHADOWS;
}
