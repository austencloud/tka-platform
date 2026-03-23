/**
 * Domain Config for TKA
 *
 * Single-domain architecture:
 * - tkaflowarts.com: Brand home, landing page, marketing content
 * - tkaflowarts.com/app: The app (TKA Composer product)
 * - Future: tkaflowarts.com/embed, tkaflowarts.com/kiosk, etc.
 */

/**
 * Site mode determines which experience to render.
 * Extensible for future portals without breaking changes.
 */
export type SiteMode = "loading" | "app" | "landing" | "embed" | "kiosk" | "edu";

// Landing/brand domain
export const LANDING_DOMAIN = "https://tkaflowarts.com";

// App base URL
export const APP_DOMAIN = "https://tkaflowarts.com/app";

/**
 * Detect site mode from current pathname.
 * Returns "app" when under /app, "landing" otherwise.
 * Supports ?mode= override for local dev testing.
 */
export function detectSiteMode(): SiteMode {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const modeOverride = params.get("mode") as SiteMode | null;
    if (modeOverride && ["app", "landing"].includes(modeOverride)) {
      return modeOverride;
    }
    if (window.location.pathname.startsWith("/app")) {
      return "app";
    }
  }
  return "landing";
}

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
 * Landing page SEO config
 */
export const LANDING_SEO_CONFIG = {
  siteName: "TKA - The Kinetic Alphabet",
  description:
    "TKA is a flow arts notation system for documenting and sharing choreography with dual wielded props - staff, fans, clubs, hoops, buugeng.",
  keywords:
    "flow arts notation, flow arts notation system, dual wielded props, staff notation, fan notation, club notation, TKA, The Kinetic Alphabet, TKA notation, TKA flow arts, prop notation, movement notation",
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
  siteName: "TKA Composer",
  description:
    "Create, animate, and share flow arts sequences with TKA Composer - the free choreography app for staff, clubs, fans, hoops, buugeng, and swords.",
  keywords:
    "TKA Composer, TKA app, TKA flow arts, flow arts app, sequence creator, staff choreography, club manipulation, fan spinning, buugeng patterns",
  author: "Austen Cloud",
  language: "en",
  type: "website",
};
