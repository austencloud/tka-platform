/**
 * Detects in-app browsers (Messenger, Instagram, Facebook, etc.)
 * that have restricted storage access and break Firebase auth redirects.
 */
export interface IInAppBrowserDetector {
  /**
   * Check if the current browser is an in-app webview
   */
  isInAppBrowser(): boolean;

  /**
   * Get the name of the detected in-app browser for display
   * Returns null if not an in-app browser
   */
  getInAppBrowserName(): string | null;

  /**
   * Get the appropriate "open in browser" URL for the current platform
   * On Android: intent:// URL to open in Chrome
   * On iOS: Direct URL (user must tap Safari's "Open in Safari" button)
   */
  getOpenInBrowserUrl(): string;

  /**
   * Check if we can programmatically open in external browser
   * (Only works on Android via intent:// URLs)
   */
  canOpenInExternalBrowser(): boolean;
}
