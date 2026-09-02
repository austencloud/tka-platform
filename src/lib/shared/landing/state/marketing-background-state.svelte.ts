import type { BackgroundType } from "@austencloud/backgrounds";

/**
 * Which animated background the marketing chrome renders right now.
 *
 * A module-level singleton because MarketingChrome is mounted once by the root
 * layout and survives navigation between marketing routes, so a page that wants
 * to drive the chrome (the composer showcase) has no component ancestor to hand
 * it state through. It deliberately never touches settingsService, the account
 * preference, or the `tka-public-theme-index` key: this is presentation for the
 * current visit only, and every page that does not set it gets cosmic.
 */
function createMarketingBackgroundState() {
  // Type-only import, like MarketingChrome: the backgrounds package index
  // re-exports every renderer, and this module only needs the string value.
  const DEFAULT = "cosmic" as BackgroundType;
  let type = $state<BackgroundType>(DEFAULT);

  return {
    get type() {
      return type;
    },
    set(next: BackgroundType): void {
      type = next;
    },
    reset(): void {
      type = DEFAULT;
    },
  };
}

export const marketingBackground = createMarketingBackgroundState();
