/**
 * Platform Detection Service Contract
 *
 * Provides centralized platform and browser detection capabilities.
 * Eliminates duplication of detection logic across components.
 */

export type Platform = "ios" | "android" | "desktop";
export type Browser =
  | "chrome"
  | "safari"
  | "edge"
  | "firefox"
  | "samsung"
  | "other";

/**
 * In-app browsers that don't support PWA installation
 * Users must be redirected to a real browser
 */
export type InAppBrowser =
  | "instagram"
  | "facebook"
  | "twitter"
  | "tiktok"
  | "snapchat"
  | "linkedin"
  | "pinterest"
  | "messenger"
  | "threads"
  | "none";

export interface PlatformInfo {
  platform: Platform;
  browser: Browser;
  inAppBrowser: InAppBrowser;
  isStandalone: boolean; // Already installed as PWA
}

export interface IPlatformDetector {
  /**
   * Detect the user's platform, browser, and in-app browser status
   */
  detectPlatformAndBrowser(): PlatformInfo;

  /**
   * Detect the user's platform (iOS, Android, or Desktop)
   */
  detectPlatform(): Platform;

  /**
   * Detect the user's browser
   */
  detectBrowser(): Browser;

  /**
   * Detect if running inside an in-app browser (Instagram, Facebook, etc.)
   */
  detectInAppBrowser(): InAppBrowser;

  /**
   * Check if already running as installed PWA
   */
  isRunningAsStandalone(): boolean;

  /**
   * Check if the current platform/browser combination supports native PWA install prompt
   * (beforeinstallprompt event)
   */
  supportsNativeInstallPrompt(platform: Platform, browser: Browser): boolean;

  /**
   * Check if the current platform/browser combination supports PWA installation
   * (either native or manual)
   */
  supportsPWAInstall(platform: Platform, browser: Browser): boolean;

  /**
   * Get a user-friendly browser name
   */
  getBrowserDisplayName(browser: Browser): string;

  /**
   * Get a user-friendly platform name
   */
  getPlatformDisplayName(platform: Platform): string;

  /**
   * Get a user-friendly in-app browser name
   */
  getInAppBrowserDisplayName(inAppBrowser: InAppBrowser): string;
}
