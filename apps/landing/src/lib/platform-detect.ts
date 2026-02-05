export type Platform = "ios" | "android" | "desktop";
export type InAppBrowser = "instagram" | "facebook" | "tiktok" | "snapchat" | "messenger" | "threads" | "none";

export interface PlatformInfo {
  platform: Platform;
  browser: string;
  inAppBrowser: InAppBrowser;
  isStandalone: boolean;
}

export function detectPlatformAndBrowser(): PlatformInfo {
  const ua = navigator.userAgent.toLowerCase();

  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const platform: Platform = isIOS ? "ios" : isAndroid ? "android" : "desktop";

  let browser = "unknown";
  if (/crios/.test(ua)) browser = "chrome";
  else if (/fxios/.test(ua)) browser = "firefox";
  else if (/safari/.test(ua) && !/chrome/.test(ua)) browser = "safari";
  else if (/chrome/.test(ua)) browser = "chrome";
  else if (/firefox/.test(ua)) browser = "firefox";

  let inAppBrowser: InAppBrowser = "none";
  if (/instagram/.test(ua)) inAppBrowser = "instagram";
  else if (/fbav|fban/.test(ua)) inAppBrowser = "facebook";
  else if (/musical_ly|tiktok|bytedance/.test(ua)) inAppBrowser = "tiktok";
  else if (/snapchat/.test(ua)) inAppBrowser = "snapchat";
  else if (/messenger/.test(ua)) inAppBrowser = "messenger";
  else if (/barcelona/.test(ua)) inAppBrowser = "threads";

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;

  return { platform, browser, inAppBrowser, isStandalone };
}
