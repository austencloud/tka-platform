/**
 * Domain Config for TKA
 *
 * Multi-domain architecture:
 * - tkaflowarts.com: Brand home, landing page, marketing content
 * - tkascribe.com: The app (TKA Scribe product)
 * - Future: embed.tkascribe.com, kiosk.tkascribe.com, edu.tkascribe.com, etc.
 */

/**
 * Site mode determines which experience to render.
 * Extensible for future portals without breaking changes.
 */
export type SiteMode = "loading" | "app" | "landing" | "embed" | "kiosk" | "edu";

// Landing/brand domain
export const LANDING_DOMAIN = "https://tkaflowarts.com";

// App domain
export const APP_DOMAIN = "https://tkascribe.com";

// Domain-to-mode mapping (extensible for future portals)
const DOMAIN_MODE_MAP: Record<string, SiteMode> = {
  "tkascribe.com": "app",
  "www.tkascribe.com": "app",
  "tkaflowarts.com": "landing",
  "www.tkaflowarts.com": "landing",
  // Future portals:
  // "embed.tkascribe.com": "embed",
  // "kiosk.tkascribe.com": "kiosk",
  // "edu.tkascribe.com": "edu",
};

/**
 * Detect site mode from current origin.
 * Returns the appropriate mode for rendering.
 */
export function detectSiteMode(origin: string): SiteMode {
  try {
    const hostname = new URL(origin).hostname;

    // Check direct mapping
    if (hostname in DOMAIN_MODE_MAP) {
      return DOMAIN_MODE_MAP[hostname];
    }

    // Localhost/dev defaults to app mode
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "app";
    }

    // Netlify preview deploys
    if (hostname.endsWith(".netlify.app")) {
      // tkaflowarts.netlify.app → landing, otherwise app
      return hostname.includes("tkaflowarts") ? "landing" : "app";
    }

    // Unknown domain defaults to app
    return "app";
  } catch {
    return "app";
  }
}

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
    "The universal notation system for flow arts - digital sheet music for props like staff, hoop, fans, clubs, and buugeng.",
  keywords: "flow arts, notation, staff, clubs, fans, hoop, buugeng, swords, choreography",
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
    "Create, animate, and share flow arts sequences with TKA Scribe - the free choreography app for staff, clubs, fans, hoops, buugeng, and swords.",
  keywords: "flow arts app, sequence creator, staff choreography, club manipulation, fan spinning, buugeng patterns",
  author: "Austen Cloud",
  language: "en",
  type: "website",
};
