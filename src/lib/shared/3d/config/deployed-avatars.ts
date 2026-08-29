import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";

/**
 * Avatars whose GLB is actually deployed and loadable.
 *
 * The scene-3d registry is the deployment boundary: every definition it
 * exports has an optimized public model URL. Keep this app-facing name for
 * callers that care about deployment availability without guessing from a URL
 * scheme.
 */
export const DEPLOYED_AVATAR_DEFINITIONS = AVATAR_DEFINITIONS.filter(
  (avatar) => avatar.availability !== "local-evaluation"
);

export const DEPLOYED_AVATAR_IDS: AvatarId[] = DEPLOYED_AVATAR_DEFINITIONS.map(
  (a) => a.id as AvatarId
);
