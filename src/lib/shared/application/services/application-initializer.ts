
/**
 * Application Initializer Implementation
 *
 * Handles application startup sequence and initialization.
 */
export class ApplicationInitializer {
  private initialized = false;

  constructor() {}

  async initialize(): Promise<void> {
    // ⚡ PERFORMANCE: SVG preloading now uses lazy loading.
    // Props and grids are fetched on-demand when first needed, then cached.
    // This eliminates 15+ network requests at startup.
    // See SvgPreloader.getSvgContent() for on-demand loading.
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }
}
