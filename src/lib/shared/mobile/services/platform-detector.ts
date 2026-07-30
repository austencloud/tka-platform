import type { Platform, Browser, InAppBrowser, PlatformInfo } from "./types";
import { BREAKPOINTS } from "../../device/domain/constants/device-constants";

interface VendorNavigator extends Navigator {
  standalone?: boolean;
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  if (typeof window === "undefined") return "desktop";

  const ua = navigator.userAgent.toLowerCase();
  const isIPadOSDesktopUserAgent =
    ua.includes("macintosh") && navigator.maxTouchPoints > 1;

  // iPadOS asks Safari for a desktop-class user agent by default and can
  // report a fine pointer + hover when a trackpad is attached. Identify it
  // before the desktop capability gate so native sharing stays available.
  if (/iphone|ipad|ipod/.test(ua) || isIPadOSDesktopUserAgent) {
    return "ios";
  }

  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  const hasHover = window.matchMedia("(hover: hover)").matches;
  const isLargeScreen = window.innerWidth >= BREAKPOINTS.DESKTOP;

  if (hasFinePointer && hasHover && isLargeScreen) {
    return "desktop";
  }

  if (/android/.test(ua)) {
    return "android";
  }

  return "desktop";
}

export function detectBrowser(): Browser {
  if (typeof navigator === "undefined") return "other";

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("samsungbrowser")) return "samsung";
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("firefox") || ua.includes("fxios")) return "firefox";
  if (ua.includes("chrome") || ua.includes("crios")) return "chrome";
  if (ua.includes("safari")) return "safari";

  return "other";
}

export function detectInAppBrowser(): InAppBrowser {
  if (typeof navigator === "undefined") return "none";

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("instagram")) return "instagram";
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab"))
    return "facebook";
  if (ua.includes("messenger")) return "messenger";
  if (ua.includes("twitter")) return "twitter";
  if (
    ua.includes("tiktok") ||
    ua.includes("bytedance") ||
    ua.includes("musical_ly")
  )
    return "tiktok";
  if (ua.includes("snapchat")) return "snapchat";
  if (ua.includes("linkedin")) return "linkedin";
  if (ua.includes("pinterest")) return "pinterest";
  if (ua.includes("barcelona")) return "threads";

  return "none";
}

export function isRunningAsStandalone(): boolean {
  if (typeof window === "undefined") return false;

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
  const isMinimalUI = window.matchMedia("(display-mode: minimal-ui)").matches;
  const iOSStandalone =
    (window.navigator as VendorNavigator).standalone === true;
  const isAndroidTWA = document.referrer.includes("android-app://");

  return (
    isStandalone || isFullscreen || isMinimalUI || iOSStandalone || isAndroidTWA
  );
}

export function detectPlatformAndBrowser(): PlatformInfo {
  return {
    platform: detectPlatform(),
    browser: detectBrowser(),
    inAppBrowser: detectInAppBrowser(),
    isStandalone: isRunningAsStandalone(),
  };
}

export function supportsNativeInstallPrompt(
  platform: Platform,
  browser: Browser
): boolean {
  if (platform === "android") {
    return ["chrome", "edge", "samsung"].includes(browser);
  }

  if (platform === "desktop") {
    return ["chrome", "edge"].includes(browser);
  }

  return false;
}

export function supportsPWAInstall(
  platform: Platform,
  browser: Browser
): boolean {
  if (platform === "ios") return browser === "safari";

  if (platform === "android") {
    return ["chrome", "edge", "samsung", "firefox"].includes(browser);
  }

  if (platform === "desktop") {
    return ["chrome", "edge"].includes(browser);
  }

  return false;
}

export function getBrowserDisplayName(browser: Browser): string {
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

export function getPlatformDisplayName(platform: Platform): string {
  const names: Record<Platform, string> = {
    ios: "iOS",
    android: "Android",
    desktop: "Desktop",
  };

  return names[platform];
}

export function getInAppBrowserDisplayName(inAppBrowser: InAppBrowser): string {
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
