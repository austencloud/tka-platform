/**
 * Detects in-app browsers that have restricted storage access.
 *
 * These webviews partition sessionStorage, breaking Firebase's signInWithRedirect.
 * Common culprits: Messenger, Instagram, Facebook, Twitter, TikTok, Line, etc.
 */

interface BrowserPattern {
  pattern: RegExp;
  name: string;
}

const IN_APP_BROWSER_PATTERNS: BrowserPattern[] = [
  // Meta platforms
  { pattern: /FBAN|FBAV/i, name: "Facebook" },
  { pattern: /FB_IAB/i, name: "Facebook" },
  { pattern: /Messenger/i, name: "Messenger" },
  { pattern: /Instagram/i, name: "Instagram" },

  // Other social apps
  { pattern: /Twitter/i, name: "Twitter" },
  { pattern: /Line\//i, name: "Line" },
  { pattern: /KAKAOTALK/i, name: "KakaoTalk" },
  { pattern: /Snapchat/i, name: "Snapchat" },
  { pattern: /TikTok/i, name: "TikTok" },
  { pattern: /BytedanceWebview/i, name: "TikTok" },
  { pattern: /WeChat|MicroMessenger/i, name: "WeChat" },
  { pattern: /Telegram/i, name: "Telegram" },
  { pattern: /Discord/i, name: "Discord" },
  { pattern: /Slack/i, name: "Slack" },

  // Generic webview indicators
  { pattern: /\bwv\b/i, name: "WebView" },
  { pattern: /WebView/i, name: "WebView" },
];

export class InAppBrowserDetector {
  private cachedResult: { isInApp: boolean; name: string | null } | null = null;

  isInAppBrowser(): boolean {
    return this.detect().isInApp;
  }

  getInAppBrowserName(): string | null {
    return this.detect().name;
  }

  getOpenInBrowserUrl(): string {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";

    // On Android, we can use intent:// to open in Chrome
    if (this.isAndroid()) {
      // intent://host/path#Intent;scheme=https;package=com.android.chrome;end
      const url = new URL(currentUrl);
      return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=https;package=com.android.chrome;end`;
    }

    // On iOS, we can't programmatically open Safari
    // User needs to tap the Safari icon or use "Open in Safari" option
    return currentUrl;
  }

  canOpenInExternalBrowser(): boolean {
    // Only Android supports intent:// URLs for opening in external browser
    return this.isAndroid();
  }

  private detect(): { isInApp: boolean; name: string | null } {
    if (this.cachedResult) {
      return this.cachedResult;
    }

    if (typeof navigator === "undefined") {
      this.cachedResult = { isInApp: false, name: null };
      return this.cachedResult;
    }

    const ua = navigator.userAgent || "";
    const vendor = (navigator as { vendor?: string }).vendor || "";
    const combined = `${ua} ${vendor}`;

    for (const { pattern, name } of IN_APP_BROWSER_PATTERNS) {
      if (pattern.test(combined)) {
        this.cachedResult = { isInApp: true, name };
        return this.cachedResult;
      }
    }

    // Additional heuristic: iOS standalone mode with no Safari indicators
    // This catches some edge cases where the webview doesn't identify itself
    if (this.isIOS() && !combined.includes("Safari")) {
      this.cachedResult = { isInApp: true, name: "App" };
      return this.cachedResult;
    }

    this.cachedResult = { isInApp: false, name: null };
    return this.cachedResult;
  }

  private isAndroid(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android/i.test(navigator.userAgent);
  }

  private isIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
}
