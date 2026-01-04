/**
 * Domain Config for TKA
 *
 * Two-domain architecture:
 * - tkaflowarts.com: Brand home, landing page, marketing content
 * - tkascribe.com: The app (TKA Scribe product)
 */

// Landing/brand domain
export const LANDING_DOMAIN = "https://tkaflowarts.com";

// App domain
export const APP_DOMAIN = "https://tkascribe.com";

// Legacy aliases (will redirect)
export const LEGACY_DOMAINS = [
  "https://kineticalphabet.com",
  "https://www.kineticalphabet.com",
];

// All valid domains
export const ALL_DOMAINS = [
  LANDING_DOMAIN,
  APP_DOMAIN,
  `https://www.tkaflowarts.com`,
  `https://www.tkascribe.com`,
  ...LEGACY_DOMAINS,
];

/**
 * Get the canonical URL for landing pages
 */
export function getLandingCanonicalURL(path: string = ""): string {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return cleanPath ? `${LANDING_DOMAIN}/${cleanPath}` : LANDING_DOMAIN;
}

/**
 * Get the canonical URL for app pages
 */
export function getAppCanonicalURL(path: string = ""): string {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return cleanPath ? `${APP_DOMAIN}/${cleanPath}` : APP_DOMAIN;
}

/**
 * Check if current domain is the landing domain
 */
export function isLandingDomain(currentOrigin: string): boolean {
  return (
    currentOrigin === new URL(LANDING_DOMAIN).origin ||
    currentOrigin === "https://www.tkaflowarts.com"
  );
}

/**
 * Check if current domain is the app domain
 */
export function isAppDomain(currentOrigin: string): boolean {
  return (
    currentOrigin === new URL(APP_DOMAIN).origin ||
    currentOrigin === "https://www.tkascribe.com"
  );
}

/**
 * Landing page SEO config
 */
export const LANDING_SEO_CONFIG = {
  siteName: "The Kinetic Alphabet",
  description:
    "The universal notation system for flow arts - digital sheet music for poi, staff, hoop, and buugeng choreography.",
  keywords: "flow arts, notation, poi, staff, hoop, buugeng, choreography",
  author: "Austen Cloud",
  language: "en",
  type: "website",
  social: {
    instagram: "@tkaflowarts",
    facebook: "@tkaflowarts",
    twitter: "@tkaflowarts",
  },
};

/**
 * App SEO config
 */
export const APP_SEO_CONFIG = {
  siteName: "TKA Scribe",
  description:
    "Create, animate, and share flow arts sequences with TKA Scribe - the free choreography app for poi, staff, hoop, and buugeng.",
  keywords: "flow arts app, sequence creator, poi patterns, staff choreography",
  author: "Austen Cloud",
  language: "en",
  type: "website",
};
