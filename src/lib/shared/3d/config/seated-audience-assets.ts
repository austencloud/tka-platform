import { getAvatarModelPath, type AvatarId } from "@austencloud/scene-3d";
import { R2_CDN } from "../constants/r2-cdn";

/**
 * Keep the audience's cast as avatar IDs, then resolve through scene-3d's
 * canonical deployment registry. The registry owns where a model is hosted;
 * the audience only owns who occupies each seat.
 */
export const SEATED_AUDIENCE_AVATAR_IDS = [
  "ch18",
  "ch24",
  "ch34",
  "ch10",
  "ch12",
  "ch44",
] as const satisfies readonly AvatarId[];

export const SEATED_AUDIENCE_AVATAR_URLS =
  SEATED_AUDIENCE_AVATAR_IDS.map(getAvatarModelPath);

export const SEATED_AUDIENCE_ANIMATION_URLS = [
  `${R2_CDN}/animations/v2026-07-23-r1/sitting-idle-a.fbx.bin`,
  `${R2_CDN}/animations/v2026-07-23-r1/sitting-idle-b.fbx.bin`,
] as const;
