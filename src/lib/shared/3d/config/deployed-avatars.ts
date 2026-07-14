import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";

/**
 * Avatars whose GLB is actually deployed and loadable.
 *
 * The scene-3d package defines 16 avatars, but only x-bot / y-bot / remy / ch26
 * are uploaded to R2 (their modelPath is an https R2_CDN URL). The 12 chXX
 * Mixamo full-body models are gitignored locally and not yet on R2 — they need
 * a Blender optimize pass (decimate + KTX2 + Draco) before they can ship — so
 * their local `/models/avatars/chXX.glb` paths 404 everywhere and flood the
 * console when the village randomly assigns them.
 *
 * Filtering by URL scheme is self-correcting: once a chXX is repointed to
 * R2_CDN in the scene-3d package, it appears here automatically with no change.
 */
export const DEPLOYED_AVATAR_DEFINITIONS = AVATAR_DEFINITIONS.filter((a) =>
  a.modelPath.startsWith("http"),
);

export const DEPLOYED_AVATAR_IDS: AvatarId[] = DEPLOYED_AVATAR_DEFINITIONS.map(
  (a) => a.id as AvatarId,
);
