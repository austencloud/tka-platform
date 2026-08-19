export const R2_CDN = "https://assets.tkaflowarts.com";

/**
 * Square preview image for an avatar model. One owner for the path so the
 * picker grid and the performer-hub summary row can never drift apart.
 */
export function avatarThumbnailUrl(avatarId: string): string {
  return `${R2_CDN}/models/avatars/thumbnails/${avatarId}.webp`;
}
