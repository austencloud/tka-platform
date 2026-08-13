export interface ForestShadowRole {
  cast: boolean;
  receive: boolean;
}

const NO_SHADOWS: ForestShadowRole = { cast: false, receive: false };
const RECEIVER_ONLY: ForestShadowRole = { cast: false, receive: true };

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
 * The ecological atlas owns tree-root contact. Full Poly Haven tree meshes are
 * deliberately kept out of the depth pass because their alpha-card crowns
 * produce hard polygon islands on the clearing. Local rocks and deadwood still
 * cast real contact shadows, and ground detail receives the result.
 */
export function resolveForestNearFrameShadowRole(
  role: unknown,
  shadowsEnabled: boolean
): ForestShadowRole {
  if (!shadowsEnabled) return NO_SHADOWS;
  if (role === "near-frame-static-prop") {
    return { cast: true, receive: true };
  }
  return role === "near-frame-tree" || role === "near-frame-grass"
    ? RECEIVER_ONLY
    : NO_SHADOWS;
}
