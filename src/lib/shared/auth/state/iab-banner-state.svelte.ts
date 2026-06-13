/**
 * Shared reactive state for the in-app browser banner visibility.
 *
 * Used by the sequence route to add bottom padding when the banner is showing,
 * preventing it from overlapping the footer content.
 *
 * Domain: Auth - In-App Browser Detection
 */

let bannerVisible = $state(false);

export function setIabBannerVisible(visible: boolean): void {
  bannerVisible = visible;
}

export function getIabBannerVisible(): boolean {
  return bannerVisible;
}

/**
 * Height of the IAB banner in pixels.
 * Used to calculate bottom padding for the sequence route page.
 */
export const IAB_BANNER_HEIGHT = 56;
