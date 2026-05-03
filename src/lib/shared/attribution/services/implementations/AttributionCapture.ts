/**
 * Attribution Capture Service Implementation
 *
 * Captures all attribution signals from the current page context.
 * Designed to be called on page load and when URL parameters change.
 */

import { BREAKPOINTS } from "../../../device/domain/constants/device-constants";
import type {
  TouchData,
  UtmParameters,
  ClickIds,
  ReferrerInfo,
  DeviceInfo,
  DeviceCategory,
} from "../../domain/types";
import {
  categorizeReferrer,
  extractDomain,
} from "../../config/referrer-patterns";

export class AttributionCapture {
  /**
   * Capture complete touch data from current page context
   */
  captureTouchData(): TouchData {
    return {
      timestamp: new Date().toISOString(),
      utm: this.captureUtmParameters(),
      clickIds: this.captureClickIds(),
      referrer: this.captureReferrer(),
      landingPage: this.getLandingPage(),
      locale: this.getLocale(),
      device: this.captureDeviceInfo(),
    };
  }

  /**
   * Extract UTM parameters from current URL
   */
  captureUtmParameters(): UtmParameters {
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

  /**
   * Extract platform click IDs from current URL
   */
  captureClickIds(): ClickIds {
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

  /**
   * Analyze the document referrer
   */
  captureReferrer(): ReferrerInfo {
    if (typeof document === "undefined") {
      return { raw: "", category: "direct" };
    }

    const raw = document.referrer || "";
    const category = categorizeReferrer(raw);
    const domain = extractDomain(raw);

    return { raw, domain, category };
  }

  /**
   * Capture device/browser information
   * Minimal data for privacy - no fingerprinting
   */
  captureDeviceInfo(): DeviceInfo {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return {
        type: "desktop",
        language: "en",
        platform: "unknown",
        screenCategory: "medium",
      };
    }

    return {
      type: this.detectDeviceType(),
      language: navigator.language || "en",
      platform: this.detectPlatform(),
      screenCategory: this.categorizeScreenSize(),
    };
  }

  /**
   * Check if current URL has any attribution parameters
   */
  hasAttributionParams(): boolean {
    const utm = this.captureUtmParameters();
    const clickIds = this.captureClickIds();

    const hasUtm = Object.values(utm).some((v) => v !== undefined);
    const hasClickIds = Object.values(clickIds).some((v) => v !== undefined);

    return hasUtm || hasClickIds;
  }

  /**
   * Check if the current touch differs meaningfully from a previous touch
   * We consider it different if:
   * - UTM source/medium/campaign changed
   * - Click IDs changed
   * - Referrer category changed
   */
  isDifferentTouch(previous: TouchData, current: TouchData): boolean {
    // Different UTM params
    if (
      previous.utm.source !== current.utm.source ||
      previous.utm.medium !== current.utm.medium ||
      previous.utm.campaign !== current.utm.campaign
    ) {
      return true;
    }

    // Different click IDs (any non-matching)
    const prevClickIds = previous.clickIds;
    const currClickIds = current.clickIds;
    const clickIdKeys = [
      "fbclid",
      "gclid",
      "ttclid",
      "twclid",
      "msclkid",
      "li_fat_id",
    ] as const;

    for (const key of clickIdKeys) {
      if (prevClickIds[key] !== currClickIds[key]) {
        // Only count as different if current has a value
        // (we don't care if old click ID is gone)
        if (currClickIds[key]) {
          return true;
        }
      }
    }

    // Different referrer category (e.g., came from search, now from social)
    if (previous.referrer.category !== current.referrer.category) {
      // But ignore if current is "direct" (just means no referrer this time)
      if (current.referrer.category !== "direct") {
        return true;
      }
    }

    return false;
  }

  // === Private Helpers ===

  private getLandingPage(): string {
    if (typeof window === "undefined") return "/";
    return window.location.pathname + window.location.search;
  }

  private getLocale(): string {
    if (typeof navigator === "undefined") return "en";
    return navigator.language || "en";
  }

  private detectDeviceType(): DeviceCategory {
    if (typeof window === "undefined") return "desktop";

    const ua = navigator.userAgent.toLowerCase();
    const width = window.innerWidth;

    // Check for tablets first (they often have "mobile" in UA but larger screens)
    if (/ipad|tablet|playbook|silk/i.test(ua)) {
      return "tablet";
    }

    // Check for mobile
    if (
      /mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)
    ) {
      return "mobile";
    }

    // Fallback to screen width
    if (width < BREAKPOINTS.MOBILE) return "mobile";
    if (width < BREAKPOINTS.DESKTOP) return "tablet";

    return "desktop";
  }

  private detectPlatform(): string {
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

  private categorizeScreenSize(): "small" | "medium" | "large" {
    if (typeof window === "undefined") return "medium";

    const width = window.innerWidth;

    if (width < BREAKPOINTS.MOBILE) return "small";
    if (width < BREAKPOINTS.LARGE_DESKTOP) return "medium";
    return "large";
  }
}
