/**
 * Captures all attribution signals from the current page context.
 * Designed to be called on page load and when URL parameters change.
 */

import { BREAKPOINTS } from "../../device/domain/constants/device-constants";
import type {
  TouchData,
  UtmParameters,
  ClickIds,
  ReferrerInfo,
  DeviceInfo,
  DeviceCategory,
} from "../domain/types";
import { categorizeReferrer, extractDomain } from "../config/referrer-patterns";

function getLandingPage(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

function getLocale(): string {
  if (typeof navigator === "undefined") return "en";
  return navigator.language || "en";
}

function detectDeviceType(): DeviceCategory {
  if (typeof window === "undefined") return "desktop";

  const ua = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;

  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";

  if (width < BREAKPOINTS.MOBILE) return "mobile";
  if (width < BREAKPOINTS.DESKTOP) return "tablet";

  return "desktop";
}

function detectPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent;

  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua)) return "macOS";
  if (/iPad|iPhone|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Linux/i.test(ua)) return "Linux";
  if (/CrOS/i.test(ua)) return "ChromeOS";

  return "unknown";
}

function categorizeScreenSize(): "small" | "medium" | "large" {
  if (typeof window === "undefined") return "medium";

  const width = window.innerWidth;

  if (width < BREAKPOINTS.MOBILE) return "small";
  if (width < BREAKPOINTS.LARGE_DESKTOP) return "medium";
  return "large";
}

export function captureUtmParameters(): UtmParameters {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);

  return {
    source: params.get("utm_source") || undefined,
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
    content: params.get("utm_content") || undefined,
    term: params.get("utm_term") || undefined,
  };
}

export function captureClickIds(): ClickIds {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);

  return {
    fbclid: params.get("fbclid") || undefined,
    gclid: params.get("gclid") || undefined,
    ttclid: params.get("ttclid") || undefined,
    twclid: params.get("twclid") || undefined,
    msclkid: params.get("msclkid") || undefined,
    li_fat_id: params.get("li_fat_id") || undefined,
  };
}

export function captureReferrer(): ReferrerInfo {
  if (typeof document === "undefined") {
    return { raw: "", category: "direct" };
  }

  const raw = document.referrer || "";
  const category = categorizeReferrer(raw);
  const domain = extractDomain(raw);

  return { raw, domain, category };
}

export function captureDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      type: "desktop",
      language: "en",
      platform: "unknown",
      screenCategory: "medium",
    };
  }

  return {
    type: detectDeviceType(),
    language: navigator.language || "en",
    platform: detectPlatform(),
    screenCategory: categorizeScreenSize(),
  };
}

export function captureTouchData(): TouchData {
  return {
    timestamp: new Date().toISOString(),
    utm: captureUtmParameters(),
    clickIds: captureClickIds(),
    referrer: captureReferrer(),
    landingPage: getLandingPage(),
    locale: getLocale(),
    device: captureDeviceInfo(),
  };
}

export function hasAttributionParams(): boolean {
  const utm = captureUtmParameters();
  const clickIds = captureClickIds();

  const hasUtm = Object.values(utm).some((v) => v !== undefined);
  const hasClickIds = Object.values(clickIds).some((v) => v !== undefined);

  return hasUtm || hasClickIds;
}

export function isDifferentTouch(previous: TouchData, current: TouchData): boolean {
  if (
    previous.utm.source !== current.utm.source ||
    previous.utm.medium !== current.utm.medium ||
    previous.utm.campaign !== current.utm.campaign
  ) {
    return true;
  }

  const prevClickIds = previous.clickIds;
  const currClickIds = current.clickIds;
  const clickIdKeys = ["fbclid", "gclid", "ttclid", "twclid", "msclkid", "li_fat_id"] as const;

  for (const key of clickIdKeys) {
    if (prevClickIds[key] !== currClickIds[key]) {
      if (currClickIds[key]) return true;
    }
  }

  if (previous.referrer.category !== current.referrer.category) {
    if (current.referrer.category !== "direct") return true;
  }

  return false;
}
