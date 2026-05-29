import type { SEOLinkOptions } from "./types";

export function createSEOLink(path: string, options: SEOLinkOptions = {}): string {
  const { tab, section, seoMode = false } = options;

  if (seoMode) {
    return `/${path}`;
  }

  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (section) params.set("section", section);

  const queryString = params.toString();
  return queryString ? `/?${queryString}` : "/";
}

export function generateMetaTags(options: {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  canonicalUrl?: string;
}): Record<string, string> {
  const {
    title = "TKA Composer - A flow arts choreography Toolbox",
    description = "Create visual movement sequences with TKA Composer using The Kinetic Alphabet notation system",
    keywords = [],
    ogImage,
    canonicalUrl,
  } = options;

  const metaTags: Record<string, string> = {
    title,
    description,
    "og:title": title,
    "og:description": description,
    "og:type": "website",
    "twitter:card": "summary_large_image",
    "twitter:title": title,
    "twitter:description": description,
  };

  if (keywords.length > 0) {
    metaTags["keywords"] = keywords.join(", ");
  }

  if (ogImage) {
    metaTags["og:image"] = ogImage;
    metaTags["twitter:image"] = ogImage;
  }

  if (canonicalUrl) {
    metaTags["canonical"] = canonicalUrl;
    metaTags["og:url"] = canonicalUrl;
  }

  return metaTags;
}

export function isBotRequest(userAgent?: string): boolean {
  if (!userAgent && typeof navigator !== "undefined") {
    userAgent = navigator.userAgent;
  }

  if (!userAgent) return false;

  const botPatterns = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /rogerbot/i,
    /linkedinbot/i,
    /embedly/i,
    /quora link preview/i,
    /showyoubot/i,
    /outbrain/i,
    /pinterest/i,
    /developers.google.com\/\+\/web\/snippet/i,
  ];

  return botPatterns.some((pattern) => pattern.test(userAgent!));
}

/**
 * Small delay allows SEO crawlers to see content, then redirects users to home with params.
 */
export function handleSEORedirect(targetTab: string, targetSection?: string): void {
  if (typeof window === "undefined") return;

  if (isBotRequest()) return;

  const referrer = document.referrer;
  const fromSearchEngine =
    referrer.includes("google.") ||
    referrer.includes("bing.") ||
    referrer.includes("duckduckgo.") ||
    referrer === "";

  const delay = fromSearchEngine ? 200 : 100;

  setTimeout(() => {
    const params = new URLSearchParams();
    params.set("tab", targetTab);
    if (targetSection) params.set("section", targetSection);

    window.location.href = `/?${params.toString()}`;
  }, delay);
}
