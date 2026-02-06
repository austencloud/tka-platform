/**
 * SEO Service Contract
 *
 * Handles SEO-related functionality including link generation
 * and meta tag management.
 */

export interface SEOLinkOptions {
  tab?: string;
  section?: string;
  seoMode?: boolean;
}

export interface ISeoManager {
  /**
   * Generate a special SEO link that will redirect users to the SPA
   * but still provide SEO benefits
   */
  createSEOLink(path: string, options?: SEOLinkOptions): string;

  /**
   * Generate meta tags for a given page
   */
  generateMetaTags(options: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string;
    canonicalUrl?: string;
  }): Record<string, string>;

  /**
   * Check if the current request is from a search engine bot
   */
  isBotRequest(userAgent?: string): boolean;

  /**
   * Enhanced redirect logic for SEO pages
   */
  handleSEORedirect(targetTab: string, targetSection?: string): void;
}
