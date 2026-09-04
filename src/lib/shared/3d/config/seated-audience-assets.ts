import {
  getAvatarModelPath,
  type AvatarId,
} from "@austencloud/scene-3d/worker";
import { R2_CDN } from "../constants/r2-origin";

/**
 * Keep the audience's cast as character IDs, then resolve through scene-3d's
 * canonical deployment registry. The registry owns where a model is hosted;
 * the audience only owns who occupies each seat.
 */
export const SEATED_AUDIENCE_CHARACTER_IDS = [
  "ch18",
  "ch24",
  "ch34",
  "ch10",
  "ch12",
  "ch44",
] as const satisfies readonly AvatarId[];

export const SEATED_AUDIENCE_CHARACTER_URLS =
  SEATED_AUDIENCE_CHARACTER_IDS.map(getAvatarModelPath);

/**
 * `sitting-idle-a` retargets to a near-horizontal pose — head 0.23m above the
 * hips, against 0.58m for `-b` — so seats playing it read as bodies on the
 * floor rather than people watching. Until that clip is re-baked the audience
 * runs on `-b` alone; variety comes from the six characters, the per-seat time
 * offsets, and the scale jitter.
 */
export const SEATED_AUDIENCE_ANIMATION_URLS = [
  `${R2_CDN}/animations/v2026-07-23-r1/sitting-idle-b.fbx.bin`,
] as const;
