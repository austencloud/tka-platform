/**
 * Referrer Pattern Configuration
 *
 * Maps referrer domains to categories for attribution analysis.
 * Patterns are tested in order; first match wins.
 */

import type { ReferrerCategory } from "../domain/types";
import { BREAKPOINTS } from "../../device/domain/constants/device-constants";

/**
 * Regex patterns for each referrer category
 * Order matters within each category for specificity
 */
export const REFERRER_PATTERNS: Record<ReferrerCategory, RegExp[]> = {
  search: [
    // Major search engines
    /google\./i,
    /bing\./i,
    /duckduckgo\./i,
    /yahoo\./i,
    /ecosia\./i,
    /baidu\./i,
    /yandex\./i,
    /ask\./i,
    /aol\./i,
    /qwant\./i,
    /startpage\./i,
    /brave\.com\/search/i,
    /search\.brave/i,
    /mojeek\./i,
    /swisscows\./i,
    /searx/i,
  ],

  social: [
    // Meta platforms
    /facebook\./i,
    /fb\./i,
    /l\.facebook/i,
    /lm\.facebook/i,
    /m\.facebook/i,
    /instagram\./i,
    /l\.instagram/i,
    /threads\.net/i,

    // Twitter/X
    /twitter\./i,
    /t\.co/i,
    /x\.com/i,

    // Other social platforms
    /tiktok\./i,
    /reddit\./i,
    /linkedin\./i,
    /lnkd\.in/i,
    /pinterest\./i,
    /snapchat\./i,
    /tumblr\./i,
    /mastodon/i,
    /bsky\.app/i,
    /bluesky/i,

    // Messaging (when referrer is exposed)
    /discord\./i,
    /slack\./i,
    /telegram\./i,
    /whatsapp\./i,
    /messenger\./i,
  ],

  video: [
    /youtube\./i,
    /youtu\.be/i,
    /vimeo\./i,
    /twitch\./i,
    /dailymotion\./i,
    /tiktok\./i, // Also in social, but video-first
  ],

  email: [
    // Webmail clients (when they expose referrer)
    /mail\.google/i,
    /outlook\.(live|office)/i,
    /mail\.yahoo/i,
    /mail\.aol/i,
    /protonmail/i,
    /proton\.me/i,
    /tutanota/i,
    /zoho\.com\/mail/i,
    /fastmail/i,
    /hey\.com/i,
    /mailchimp/i, // Email marketing platforms
    /campaign-archive/i,
    /constantcontact/i,
    /sendgrid/i,
    /mailgun/i,
  ],

  // Referral is the fallback for any non-empty referrer
  // that doesn't match other categories
  referral: [],

  // Direct is used when referrer is empty
  direct: [],
};

/**
 * Known flow arts / prop spinning community sites
 * These get special treatment in analytics
 */
export const FLOW_COMMUNITY_DOMAINS = [
  /flowarts/i,
  /homeofpoi/i,
  /drexfactor/i,
  /playpoi/i,
  /spinmore/i,
  /flowmies/i,
  /lighttoys/i,
  /flowtoys/i,
  /moodhoops/i,
  /astralhoops/i,
  /futurehoops/i,
  /spinsterz/i,
  /thespinsterz/i,
  /fireflowart/i,
];

/**
 * Determine if a domain is a known flow arts community site
 */
export function isFlowCommunitySite(domain: string): boolean {
  return FLOW_COMMUNITY_DOMAINS.some((pattern) => pattern.test(domain));
}

/**
 * Extract domain from a URL string
 */
export function extractDomain(url: string): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    // Handle malformed URLs gracefully
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/?]+)/i);
    return match?.[1]?.replace(/^www\./, "");
  }
}

/**
 * Categorize a referrer URL
 */
export function categorizeReferrer(referrerUrl: string): ReferrerCategory {
  if (!referrerUrl || referrerUrl.trim() === "") {
    return "direct";
  }

  const domain = extractDomain(referrerUrl);
  if (!domain) {
    return "direct";
  }

  // Check each category's patterns
  for (const [category, patterns] of Object.entries(REFERRER_PATTERNS)) {
    if (category === "referral" || category === "direct") continue;

    for (const pattern of patterns) {
      if (pattern.test(referrerUrl) || pattern.test(domain)) {
        return category as ReferrerCategory;
      }
    }
  }

  // If we have a referrer but it doesn't match known patterns,
  // it's a referral from another website
  return "referral";
}

/**
 * Detect device category for attribution context
 */
export function detectDeviceCategory(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "desktop";
  }

  const ua = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;

  // Check for tablets first
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return "tablet";
  }

  // Check for mobile
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return "mobile";
  }

  // Fallback to screen width
  if (width < BREAKPOINTS.MOBILE) return "mobile";
  if (width < BREAKPOINTS.DESKTOP) return "tablet";

  return "desktop";
}
