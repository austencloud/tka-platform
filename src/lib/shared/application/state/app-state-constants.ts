import type { InfoBackground } from "./app-state-types";

export const INFO_BACKGROUND_KEY = "tka-info-background";
export const APP_MODE_KEY = "tka-app-mode";

// Default values
// Use solidColor with black as default to prevent flickering while Firebase loads user preferences
export const DEFAULT_INFO_BACKGROUND: InfoBackground = "solidColor";
