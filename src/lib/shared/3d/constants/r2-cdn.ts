import {
  CHARACTER_DEFINITIONS,
  type CharacterId,
} from "$lib/shared/3d/domain/character-model";

import { R2_CDN } from "./r2-origin";

export { R2_CDN };

/**
 * Square preview image for a character model. One owner for the path so the
 * picker grid and the performer-hub summary row can never drift apart.
 */
export function characterThumbnailUrl(characterId: CharacterId): string | null {
  const definition = CHARACTER_DEFINITIONS.find(
    (character) => character.id === characterId
  );
  if (
    definition?.availability === "local-evaluation" &&
    !definition.thumbnailPath
  ) {
    return null;
  }

  return (
    definition?.thumbnailPath ??
    `${R2_CDN}/models/avatars/thumbnails/${characterId}.webp`
  );
}
