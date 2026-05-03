import type { Platform, Browser, InAppBrowser, PlatformInfo } from "../contracts/types";
import { BREAKPOINTS } from "../../../device/domain/constants/device-constants";

interface VendorNavigator extends Navigator {
  standalone?: boolean;
}

/**
 * Platform Detection Service Implementation
 *
 * Provides comprehensive platform, browser, and in-app browser detection.
 * Critical for determining the correct PWA installation flow.
 */
export class PlatformDetector {
  detectPlatformAndBrowser(): PlatformInfo {
    return {
      platform: this.detectPlatform(),
      browser: this.detectBrowser(),
      inAppBrowser: this.detectInAppBrowser(),
      isStandalone: this.isRunningAsStandalone(),
    };
  }

  detectPlatform(): Platform {
    if (typeof navigator === "undefined") return "desktop";
    if (typeof window === "undefined") return "desktop";

    const ua = navigator.userAgent.toLowerCase();

    // First, check if this is actually a desktop device disguised as mobile
    // (e.g., Chrome DevTools emulation, or just user agent spoofing)
    // A real mobile device will have touch AND coarse pointer
    // A desktop with DevTools emulation will have fine pointer (mouse)
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    const hasHover = window.matchMedia("(hover: hover)").matches;
    const isLargeScreen = window.innerWidth >= BREAKPOINTS.DESKTOP;

    // If the device has a mouse pointer with hover AND large screen,
    // it's desktop regardless of what the user agent says
    if (hasFinePointer && hasHover && isLargeScreen) {
      return "desktop";
    }

    if (/iphone|ipad|ipod/.test(ua)) {
      return "ios";
    }

    if (/android/.test(ua)) {
      return "android";
    }

    return "desktop";
  }

  detectBrowser(): Browser {
    if (typeof navigator === "undefined") return "other";

    const ua = navigator.userAgent.toLowerCase();

    // Check for Samsung Internet first (most specific)
    if (ua.includes("samsungbrowser")) {
      return "samsung";
    }

    // Check for Edge (before Chrome, as Edge UA contains "chrome")
    if (ua.includes("edg/")) {
      return "edge";
    }

    // Check for Firefox
    if (ua.includes("firefox") || ua.includes("fxios")) {
      return "firefox";
    }

    // Check for Chrome (excludes Edge and Samsung)
    if (ua.includes("chrome") || ua.includes("crios")) {
      return "chrome";
    }

    // Check for Safari (must be after Chrome/Edge/Firefox checks)
    if (ua.includes("safari")) {
      return "safari";
    }

    return "other";
  }

  /**
   * Detect if running inside an in-app browser
   * These browsers don't support PWA installation and need special handling
   */
  detectInAppBrowser(): InAppBrowser {
    if (typeof navigator === "undefined") return "none";

    const ua = navigator.userAgent.toLowerCase();

    // Instagram: contains "instagram" in UA
    if (ua.includes("instagram")) {
      return "instagram";
    }

    // Facebook: contains "fban" or "fbav" (Facebook App Native/Version)
    if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab")) {
      return "facebook";
    }

    // Messenger: contains "messenger"
    if (ua.includes("messenger")) {
      return "messenger";
    }

    // Twitter/X: contains "twitter"
    if (ua.includes("twitter")) {
      return "twitter";
    }

    // TikTok: contains "tiktok" or "bytedance"
    if (
      ua.includes("tiktok") ||
      ua.includes("bytedance") ||
      ua.includes("musical_ly")
    ) {
      return "tiktok";
    }

    // Snapchat: contains "snapchat"
    if (ua.includes("snapchat")) {
      return "snapchat";
    }

    // LinkedIn: contains "linkedin"
    if (ua.includes("linkedin")) {
      return "linkedin";
    }

    // Pinterest: contains "pinterest"
    if (ua.includes("pinterest")) {
      return "pinterest";
    }

    // Threads: contains "barcelona" (Threads internal name)
    if (ua.includes("barcelona")) {
      return "threads";
    }

    return "none";
  }

  /**
   * Check if already running as an installed PWA
   */
  isRunningAsStandalone(): boolean {
    if (typeof window === "undefined") return false;

    // Check display-mode media queries
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;
    const isFullscreen = window.matchMedia(
      "(display-mode: fullscreen)"
    ).matches;
    const isMinimalUI = window.matchMedia("(display-mode: minimal-ui)").matches;

    // iOS Safari standalone mode
    const iOSStandalone =
      (window.navigator as VendorNavigator).standalone === true;

    // Android TWA (Trusted Web Activity)
    const isAndroidTWA = document.referrer.includes("android-app://");

    return (
      isStandalone ||
      isFullscreen ||
      isMinimalUI ||
      iOSStandalone ||
      isAndroidTWA
    );
  }

  /**
   * Check if the browser supports the native beforeinstallprompt event
   * This allows one-click installation
   */
  supportsNativeInstallPrompt(platform: Platform, browser: Browser): boolean {
    // Only Chromium-based browsers on Android and Desktop support this
    if (platform === "android") {
      return ["chrome", "edge", "samsung"].includes(browser);
    }

    if (platform === "desktop") {
      return ["chrome", "edge"].includes(browser);
    }

    // iOS NEVER supports beforeinstallprompt
    return false;
  }

  /**
   * Check if the platform/browser supports PWA installation (native or manual)
   */
  supportsPWAInstall(platform: Platform, browser: Browser): boolean {
    // iOS only supports Safari (and it's manual)
    if (platform === "ios") {
      return browser === "safari";
    }

    // Android supports Chrome, Edge, and Samsung Internet (native)
    // Other browsers may work but with manual steps
    if (platform === "android") {
      return ["chrome", "edge", "samsung", "firefox"].includes(browser);
    }

    // Desktop supports Chrome and Edge (native)
    if (platform === "desktop") {
      return ["chrome", "edge"].includes(browser);
    }

    return false;
  }

  getBrowserDisplayName(browser: Browser): string {
    const names: Record<Browser, string> = {
      chrome: "Chrome",
      safari: "Safari",
      edge: "Edge",
      firefox: "Firefox",
      samsung: "Samsung Internet",
      other: "your browser",
    };

    return names[browser];
  }

  getPlatformDisplayName(platform: Platform): string {
    const names: Record<Platform, string> = {
      ios: "iOS",
      android: "Android",
      desktop: "Desktop",
    };

    return names[platform];
  }

  getInAppBrowserDisplayName(inAppBrowser: InAppBrowser): string {
    const names: Record<InAppBrowser, string> = {
      instagram: "Instagram",
      facebook: "Facebook",
      twitter: "X (Twitter)",
      tiktok: "TikTok",
      snapchat: "Snapchat",
      linkedin: "LinkedIn",
      pinterest: "Pinterest",
      messenger: "Messenger",
      threads: "Threads",
      none: "",
    };

    return names[inAppBrowser];
  }
}
