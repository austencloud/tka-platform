/**
 * Shared reactive state for the in-app browser banner.
 *
 * The banner used to be scoped to the sequence viewer, so this only had to tell
 * that one route to pad its footer. It now renders on every route, so the root
 * layout reads it too and publishes the reservation as a CSS variable for the
 * app shell.
 *
 * The height is measured rather than assumed: the banner carries two lines of
 * copy that wrap differently on a narrow phone, and a reservation that
 * disagrees with the real bar is how content ends up hidden underneath it.
 *
 * Domain: Auth - In-App Browser Detection
 */

let bannerVisible = $state(false);
let bannerHeight = $state(0);

export function setIabBannerVisible(visible: boolean): void {
  bannerVisible = visible;
}

export function getIabBannerVisible(): boolean {
  return bannerVisible;
}

/** Reported by the banner itself once it has laid out. */
export function setIabBannerHeight(height: number): void {
  bannerHeight = height;
}

/** Measured banner height in px, or 0 when no banner is showing. */
export function getIabBannerHeight(): number {
  return bannerVisible ? bannerHeight : 0;
}

/**
 * Fallback height in pixels, used before the banner has measured itself.
 * Prefer `getIabBannerHeight()`.
 */
export const IAB_BANNER_HEIGHT = 56;
