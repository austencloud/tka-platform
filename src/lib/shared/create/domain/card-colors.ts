/**
 * Card color definitions for Generate panel
 *
 * Defines gradient colors for each card type, with variants for
 * bright backgrounds (like Aurora) where normal colors wash out.
 */

import { BackgroundType } from "@austencloud/backgrounds";

export interface CardColorSet {
  color: string;
  shadowColor: string;
}

export interface CardColors {
  level: CardColorSet;
  length: CardColorSet;
  mode: CardColorSet;
  gridMode: CardColorSet;
  continuity: CardColorSet;
  turnIntensity: CardColorSet;
  period: CardColorSet;
  startEnd: CardColorSet;
  duration: CardColorSet;
  wordInput: CardColorSet;
  customize: CardColorSet;
  favorite: CardColorSet;
}

/**
 * Default card colors - used for most backgrounds
 */
const DEFAULT_COLORS: CardColors = {
  level: {
    color: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
    shadowColor: "215deg 20% 40%",
  },
  length: {
    color: "linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)",
    shadowColor: "220deg 70% 50%",
  },
  mode: {
    color: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)",
    shadowColor: "270deg 70% 55%",
  },
  gridMode: {
    color: "linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)",
    shadowColor: "170deg 70% 45%",
  },
  continuity: {
    color: "linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)",
    shadowColor: "190deg 75% 50%",
  },
  turnIntensity: {
    color: "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)",
    shadowColor: "140deg 70% 45%",
  },
  period: {
    color: "linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)",
    shadowColor: "330deg 75% 55%",
  },
  startEnd: {
    color: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
    shadowColor: "215deg 20% 40%",
  },
  duration: {
    color: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
    shadowColor: "38deg 75% 50%",
  },
  wordInput: {
    color: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    shadowColor: "160deg 70% 40%",
  },
  customize: {
    color: "linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)",
    shadowColor: "190deg 75% 50%",
  },
  favorite: {
    color: "linear-gradient(135deg, #e11d48 0%, #be123c 50%, #9f1239 100%)",
    shadowColor: "350deg 75% 50%",
  },
};

/**
 * Vibrant but darker colors for bright/glowing backgrounds like Aurora, Ember
 * These maintain visibility while keeping rich, saturated colors
 */
const BRIGHT_BACKGROUND_COLORS: CardColors = {
  level: {
    // Rich deep slate with some warmth
    color: "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
    shadowColor: "220deg 25% 20%",
  },
  length: {
    // Rich sapphire blue - darker but still vibrant
    color: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
    shadowColor: "225deg 80% 45%",
  },
  mode: {
    // Deep violet - saturated and rich
    color: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)",
    shadowColor: "270deg 75% 50%",
  },
  gridMode: {
    // Deep teal - rich and visible
    color: "linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #115e59 100%)",
    shadowColor: "170deg 75% 35%",
  },
  continuity: {
    // Deep cyan - saturated
    color: "linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)",
    shadowColor: "195deg 80% 40%",
  },
  turnIntensity: {
    // Deep emerald - rich green
    color: "linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)",
    shadowColor: "160deg 75% 35%",
  },
  period: {
    // Deep rose/magenta - vibrant
    color: "linear-gradient(135deg, #db2777 0%, #be185d 50%, #9d174d 100%)",
    shadowColor: "330deg 80% 45%",
  },
  startEnd: {
    // Rich deep slate
    color: "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
    shadowColor: "220deg 25% 20%",
  },
  duration: {
    // Deep amber/gold - saturated
    color: "linear-gradient(135deg, #d97706 0%, #b45309 50%, #92400e 100%)",
    shadowColor: "38deg 80% 35%",
  },
  wordInput: {
    // Deep emerald - matches spell green
    color: "linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)",
    shadowColor: "160deg 75% 35%",
  },
  customize: {
    // Deep cyan
    color: "linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)",
    shadowColor: "195deg 80% 40%",
  },
  favorite: {
    color: "linear-gradient(135deg, #be123c 0%, #9f1239 50%, #881337 100%)",
    shadowColor: "350deg 80% 35%",
  },
};

/**
 * Backgrounds that need darker card colors for visibility
 * Rainbow: Bright colorful flowing bands
 * Ember: Strong warm glow that washes out lighter colors
 */
const BRIGHT_BACKGROUNDS = new Set<BackgroundType>([
  BackgroundType.RAINBOW,
  BackgroundType.EMBER,
]);

/**
 * Get card colors appropriate for the current background
 */
export function getCardColors(backgroundType: BackgroundType): CardColors {
  if (BRIGHT_BACKGROUNDS.has(backgroundType)) {
    return BRIGHT_BACKGROUND_COLORS;
  }
  return DEFAULT_COLORS;
}

/**
 * Get a single card's gradient color by its colorKey
 */
export function getCardColor(
  colorKey: keyof CardColors,
  backgroundType: BackgroundType,
): string {
  return getCardColors(backgroundType)[colorKey].color;
}

/**
 * Check if a background needs darker card colors
 */
export function isBrightBackground(backgroundType: BackgroundType): boolean {
  return BRIGHT_BACKGROUNDS.has(backgroundType);
}
