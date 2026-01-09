/**
 * DrawerEffects - Manages visual side effects when drawers open
 *
 * Handles:
 * - Background scale effect (iOS-like depth)
 * - Scroll lock (prevents body scroll while drawer is open)
 *
 * Note: Scroll lock no longer needs padding compensation because
 * `scrollbar-gutter: stable` is set globally in app.css (2024 Baseline).
 * This reserves scrollbar space even when overflow is hidden.
 */

export interface DrawerEffectsOptions {
  scaleBackground: boolean;
  preventScroll: boolean;
  isAnimatedOpen: boolean;
}

export class DrawerEffects {
  private originalBodyOverflow: string | null = null;
  private options: DrawerEffectsOptions;

  constructor(options: DrawerEffectsOptions) {
    this.options = options;
  }

  apply() {
    if (this.options.scaleBackground) {
      this.applyScaleBackground();
    }
    if (this.options.preventScroll) {
      this.applyScrollLock();
    }
  }

  cleanup() {
    if (this.options.scaleBackground) {
      this.cleanupScaleBackground();
    }
    if (this.options.preventScroll) {
      this.cleanupScrollLock();
    }
  }

  update(options: Partial<DrawerEffectsOptions>) {
    const changed =
      options.isAnimatedOpen !== this.options.isAnimatedOpen ||
      options.preventScroll !== this.options.preventScroll ||
      options.scaleBackground !== this.options.scaleBackground;

    if (changed) {
      this.cleanup();
      this.options = { ...this.options, ...options };
      this.apply();
    }
  }

  private applyScaleBackground() {
    if (this.options.isAnimatedOpen) {
      document.body.style.setProperty("--drawer-bg-scale", "0.96");
      document.body.style.setProperty("--drawer-bg-border-radius", "8px");
      document.body.classList.add("drawer-scale-bg-active");
    }
  }

  private cleanupScaleBackground() {
    document.body.style.removeProperty("--drawer-bg-scale");
    document.body.style.removeProperty("--drawer-bg-border-radius");
    document.body.classList.remove("drawer-scale-bg-active");
  }

  private applyScrollLock() {
    if (this.options.isAnimatedOpen) {
      this.originalBodyOverflow = document.body.style.overflow;
      // No padding compensation needed - scrollbar-gutter: stable handles this
      document.body.style.overflow = "hidden";
    }
  }

  private cleanupScrollLock() {
    if (this.originalBodyOverflow !== null) {
      document.body.style.overflow = this.originalBodyOverflow;
      this.originalBodyOverflow = null;
    }
  }
}
