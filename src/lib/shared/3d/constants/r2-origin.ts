/**
 * Origin for assets served from R2 rather than the Pages deploy.
 *
 * Kept apart from `r2-cdn.ts` because that module's avatar helper pulls in
 * `@austencloud/scene-3d`, and therefore three.js. The idle prefetcher needs
 * only this string, and it is imported eagerly by the sequence viewer — pulling
 * a 3D engine into that bundle to read one origin would cost more than the
 * prefetch saves.
 */
export const R2_CDN = "https://assets.tkaflowarts.com";
