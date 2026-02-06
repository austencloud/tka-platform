/**
 * PWA Install Instructions Configuration
 *
 * Centralized configuration for platform-specific PWA installation instructions.
 * This eliminates duplication and makes it easy to update instructions across the app.
 */

export interface InstructionStep {
  text: string;
  icon: string;
  image: string | null;
}

export interface InstallInstructions {
  title: string;
  icon: string;
  steps: InstructionStep[];
  benefits: string[];
}

export type Platform = "ios" | "android" | "desktop";
export type Browser =
  | "chrome"
  | "safari"
  | "edge"
  | "firefox"
  | "samsung"
  | "other";

/**
 * Get installation instructions for a specific platform and browser combination
 */
export function getInstallInstructions(
  platform: Platform,
  browser: Browser
): InstallInstructions {
  const key = `${platform}-${browser}`;

  const directMatch = INSTRUCTIONS_MAP[key];
  if (directMatch) {
    return directMatch;
  }

  // Fallback for specific platform patterns
  if (platform === "ios" && browser !== "safari") {
    return INSTRUCTIONS_MAP["ios-other"]!;
  }

  if (platform === "android" && (browser === "chrome" || browser === "edge")) {
    return INSTRUCTIONS_MAP["android-chrome"]!;
  }

  if (platform === "android" && browser === "samsung") {
    return INSTRUCTIONS_MAP["android-samsung"]!;
  }

  if (platform === "desktop" && (browser === "chrome" || browser === "edge")) {
    return INSTRUCTIONS_MAP["desktop-chrome"]!;
  }

  // Fallback for unsupported combinations
  return FALLBACK_INSTRUCTIONS[platform] ?? FALLBACK_INSTRUCTIONS["default"]!;
}

/**
 * Instructions map for specific platform-browser combinations
 */
const INSTRUCTIONS_MAP: Record<string, InstallInstructions> = {
  "ios-safari": {
    title: "Install TKA Scribe on iPhone/iPad",
    icon: "fab fa-apple",
    steps: [
      {
        text: "Tap the <strong>Share</strong> button at the bottom of Safari",
        icon: "fas fa-share",
        image: null, // TODO: Add screenshot to /static/images/install-guides/ios-safari-step1.png
      },
      {
        text: 'Scroll down and tap <strong>"Add to Home Screen"</strong>',
        icon: "fas fa-plus-square",
        image: null, // TODO: Add screenshot to /static/images/install-guides/ios-safari-step2.png
      },
      {
        text: 'Tap <strong>"Add"</strong> in the top-right corner',
        icon: "fas fa-check-circle",
        image: null, // TODO: Add screenshot to /static/images/install-guides/ios-safari-step3.png
      },
      {
        text: "Find TKA Scribe on your home screen and tap to launch",
        icon: "fas fa-mobile-alt",
        image: null,
      },
    ],
    benefits: [
      "Distraction-free, fullscreen-like experience",
      "Faster loading with offline support",
      "Quick access from home screen",
    ],
  },

  "ios-other": {
    title: "Install TKA Scribe on iPhone/iPad",
    icon: "fab fa-apple",
    steps: [
      {
        text: "Open this page in <strong>Safari</strong> (iOS only supports PWA installation in Safari)",
        icon: "fab fa-safari",
        image: null,
      },
      {
        text: "Tap the <strong>Share</strong> button at the bottom",
        icon: "fas fa-share",
        image: null, // TODO: Add screenshot
      },
      {
        text: 'Tap <strong>"Add to Home Screen"</strong>',
        icon: "fas fa-plus-square",
        image: null, // TODO: Add screenshot
      },
    ],
    benefits: [
      "Distraction-free, fullscreen-like experience",
      "Works offline",
      "Quick access from home screen",
    ],
  },

  "android-chrome": {
    title: "Install TKA Scribe on Android",
    icon: "fab fa-android",
    steps: [
      {
        text: "Tap the <strong>menu (⋮)</strong> in the top-right corner",
        icon: "fas fa-ellipsis-v",
        image: null, // TODO: Add screenshot to /static/images/install-guides/android-chrome-step1.png
      },
      {
        text: 'Select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>',
        icon: "fas fa-download",
        image: null, // TODO: Add screenshot to /static/images/install-guides/android-chrome-step2.png
      },
      {
        text: 'Tap <strong>"Install"</strong> or <strong>"Add"</strong> to confirm',
        icon: "fas fa-check-circle",
        image: null, // TODO: Add screenshot to /static/images/install-guides/android-chrome-step3.png
      },
      {
        text: "Launch TKA Scribe from your home screen or app drawer",
        icon: "fas fa-rocket",
        image: null,
      },
    ],
    benefits: [
      "Distraction-free, fullscreen-like experience",
      "Automatic offline support",
      "Native app performance",
    ],
  },

  "android-samsung": {
    title: "Install TKA Scribe on Android (Samsung Internet)",
    icon: "fab fa-android",
    steps: [
      {
        text: "Tap the <strong>menu (☰)</strong> at the bottom",
        icon: "fas fa-bars",
        image: null, // TODO: Add screenshot to /static/images/install-guides/android-samsung-step1.png
      },
      {
        text: 'Select <strong>"Add page to"</strong> → <strong>"Home screen"</strong>',
        icon: "fas fa-plus-circle",
        image: null, // TODO: Add screenshot to /static/images/install-guides/android-samsung-step2.png
      },
      {
        text: 'Tap <strong>"Add"</strong> to confirm',
        icon: "fas fa-check",
        image: null,
      },
      {
        text: "Launch TKA Scribe from your home screen",
        icon: "fas fa-mobile-alt",
        image: null,
      },
    ],
    benefits: [
      "Distraction-free, fullscreen-like experience",
      "Quick home screen access",
      "Offline support",
    ],
  },

  "desktop-chrome": {
    title: "Install TKA Scribe on Desktop",
    icon: "fas fa-desktop",
    steps: [
      {
        text: "Look for the <strong>install icon (⊕)</strong> in the address bar",
        icon: "fas fa-plus-circle",
        image: null, // TODO: Add screenshot to /static/images/install-guides/desktop-chrome-step1.png
      },
      {
        text: 'Click the icon and select <strong>"Install"</strong>',
        icon: "fas fa-download",
        image: null, // TODO: Add screenshot to /static/images/install-guides/desktop-chrome-step2.png
      },
      {
        text: 'Or open the menu (⋮) and select <strong>"Install TKA Scribe"</strong>',
        icon: "fas fa-ellipsis-v",
        image: null,
      },
      {
        text: "Launch TKA Scribe from your desktop, taskbar, or start menu",
        icon: "fas fa-window-maximize",
        image: null,
      },
    ],
    benefits: [
      "Distraction-free, fullscreen-like experience",
      "Pin to taskbar or dock",
      "Faster startup and offline support",
    ],
  },
};

/**
 * Fallback instructions for unsupported browsers
 */
const FALLBACK_INSTRUCTIONS: Record<string, InstallInstructions> = {
  ios: {
    title: "Installation Not Available",
    icon: "fas fa-info-circle",
    steps: [
      {
        text: "Your current browser doesn't fully support PWA installation",
        icon: "fas fa-exclamation-triangle",
        image: null,
      },
      {
        text: "On iOS, please use Safari for installation",
        icon: "fas fa-browser",
        image: null,
      },
    ],
    benefits: [
      "Better user experience",
      "Offline support",
      "App-like interface",
    ],
  },

  android: {
    title: "Installation Not Available",
    icon: "fas fa-info-circle",
    steps: [
      {
        text: "Your current browser doesn't fully support PWA installation",
        icon: "fas fa-exclamation-triangle",
        image: null,
      },
      {
        text: "Try using Chrome, Edge, or Samsung Internet",
        icon: "fas fa-browser",
        image: null,
      },
    ],
    benefits: [
      "Better user experience",
      "Offline support",
      "App-like interface",
    ],
  },

  desktop: {
    title: "Installation Not Available",
    icon: "fas fa-info-circle",
    steps: [
      {
        text: "Your current browser doesn't fully support PWA installation",
        icon: "fas fa-exclamation-triangle",
        image: null,
      },
      {
        text: "Try using Chrome or Edge for the best experience",
        icon: "fas fa-browser",
        image: null,
      },
    ],
    benefits: [
      "Better user experience",
      "Offline support",
      "App-like interface",
    ],
  },

  default: {
    title: "Installation Not Available",
    icon: "fas fa-info-circle",
    steps: [
      {
        text: "Your current browser doesn't fully support PWA installation",
        icon: "fas fa-exclamation-triangle",
        image: null,
      },
      {
        text: "Try using a modern browser like Chrome, Edge, or Safari",
        icon: "fas fa-browser",
        image: null,
      },
    ],
    benefits: [
      "Better user experience",
      "Offline support",
      "App-like interface",
    ],
  },
};
