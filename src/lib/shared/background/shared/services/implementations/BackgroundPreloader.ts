import { injectable } from "inversify";
import { BACKGROUND_GRADIENTS } from "../../domain/constants/BackgroundGradients";
import { BackgroundType } from "../../domain/enums/background-enums";
import type { IBackgroundPreloader } from "../contracts/IBackgroundPreloader";

let isTransitioning = false;

// Background animation mapping - same as app.html
const BACKGROUND_ANIMATIONS: Record<BackgroundType, string> = {
  pride: "rainbow-flow",
  snowfall: "snow-fall",
  nightSky: "star-twinkle",
  deepOcean: "deep-ocean-flow",
  emberGlow: "ember-glow",
  sakuraDrift: "cherry-blossom",
  fireflyForest: "firefly-forest",
  autumnDrift: "autumn-drift",
  solidColor: "", // No animation for solid colors
  linearGradient: "", // No animation for gradients
};

@injectable()
export class BackgroundPreLoader implements IBackgroundPreloader {
  /**
   * Updates the body background with smooth transition using ::before overlay technique
   * This works because CSS CAN transition opacity, even though gradients cannot be transitioned directly
   */
  updateBodyBackground(backgroundType: BackgroundType): void {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return; // SSR safety
    }

    try {
      const newGradient = BACKGROUND_GRADIENTS[backgroundType];
      const newAnimation = BACKGROUND_ANIMATIONS[backgroundType];

      // Get current gradient
      const currentGradient =
        document.documentElement.style.getPropertyValue("--gradient-cosmic");

      // Skip if already set to this gradient
      if (currentGradient === newGradient) {
        return;
      }

      if (isTransitioning) {
        return;
      }

      isTransitioning = true;
      const body = document.body;

      // Update body animation class immediately
      body.classList.remove(
        "aurora-flow",
        "snow-fall",
        "star-twinkle",
        "deep-ocean-flow",
        "ember-glow",
        "cherry-blossom",
        "firefly-forest",
        "autumn-drift"
      );
      if (newAnimation) {
        body.classList.add(newAnimation);
      }

      // Step 1: Set the ::before overlay to the NEW gradient (separate CSS variable)
      document.documentElement.style.setProperty(
        "--gradient-next",
        newGradient
      );

      // Step 2: Fade in the ::before overlay (showing NEW gradient on top of OLD)
      requestAnimationFrame(() => {
        body.classList.add("background-transitioning");
      });

      // Step 3: After transition completes, swap the gradients
      setTimeout(() => {
        document.documentElement.style.setProperty(
          "--gradient-cosmic",
          newGradient
        );
        body.classList.remove("background-transitioning");
        isTransitioning = false;
      }, 1000); // Match the CSS transition duration (1s)
    } catch (error) {
      console.warn("[Service] Failed to update body background:", error);
      isTransitioning = false;
    }
  }

  /**
   * Preloads the background from localStorage on app startup
   * This is called by the inline script in app.html
   */
  preloadBackgroundFromStorage(): void {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return; // SSR safety
    }

    try {
      const settingsKey = "tka-modern-web-settings";
      const stored = localStorage.getItem(settingsKey);

      if (stored) {
        const settings = JSON.parse(stored) as {
          backgroundType?: BackgroundType;
        };
        // Default to SOLID_COLOR to match SettingsState defaults
        const backgroundType =
          settings.backgroundType ?? BackgroundType.SOLID_COLOR;
        this.updateBodyBackground(backgroundType);
      }
    } catch (error) {
      console.warn("Failed to preload background:", error);
    }
  }
}
