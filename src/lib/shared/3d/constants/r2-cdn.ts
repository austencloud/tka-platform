import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";

import { R2_CDN } from "./r2-origin";

export { R2_CDN };

/**
 * Square preview image for an avatar model. One owner for the path so the
 * picker grid and the performer-hub summary row can never drift apart.
 */
export function avatarThumbnailUrl(avatarId: AvatarId): string | null {
  const definition = AVATAR_DEFINITIONS.find(
    (avatar) => avatar.id === avatarId
  );
  if (
    definition?.availability === "local-evaluation" &&
    !definition.thumbnailPath
  ) {
    return null;
  }

  return (
    definition?.thumbnailPath ??
    `${R2_CDN}/models/avatars/thumbnails/${avatarId}.webp`
  );
}
