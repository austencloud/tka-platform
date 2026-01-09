// background-config.ts - Background metadata configuration
import { BackgroundType } from "../../../../background/shared/domain/enums/background-enums";

export interface BackgroundMetadata {
  type: BackgroundType;
  name: string;
  description: string;
  icon: string;
  // Theme colors for animated backgrounds (used to derive UI accent)
  themeColors?: string[];
  // For simple backgrounds
  color?: string;
  colors?: string[];
  direction?: number;
}

/**
 * Available backgrounds with their metadata and animation configurations
 * themeColors represent the dominant visual palette of each background
 * for deriving consistent UI theming
 */
export const backgroundsConfig: BackgroundMetadata[] = [
  {
    type: BackgroundType.AURORA,
    name: "Aurora",
    description: "Colorful flowing aurora with lens flare",
    icon: '<i class="fas fa-star"></i>',
    // Aurora: greens, cyans, and magentas
    themeColors: ["#064e3b", "#0d9488", "#06b6d4", "#a855f7"],
  },
  {
    type: BackgroundType.SNOWFALL,
    name: "Snowfall",
    description: "Gentle falling snowflakes with shooting stars",
    icon: '<i class="fas fa-snowflake"></i>',
    // Snowfall: cool blues and icy whites
    themeColors: ["#1e3a5f", "#3b82f6", "#93c5fd"],
  },
  {
    type: BackgroundType.NIGHT_SKY,
    name: "Night Sky",
    description: "Starry night with twinkling celestial bodies",
    icon: '<i class="fas fa-moon"></i>',
    // Night sky: deep purples and indigos
    themeColors: ["#1e1b4b", "#4338ca", "#818cf8"],
  },
  {
    type: BackgroundType.DEEP_OCEAN,
    name: "Deep Ocean",
    description:
      "Immersive underwater scene with marine life and floating bubbles",
    icon: '<i class="fas fa-water"></i>',
    // Deep ocean: teals and deep blues
    themeColors: ["#0c4a6e", "#0891b2", "#22d3ee"],
  },
  {
    type: BackgroundType.EMBER_GLOW,
    name: "Ember Glow",
    description: "Warm dark amber with rising glowing embers",
    icon: "🔥",
    // Ember: warm oranges and ambers
    themeColors: ["#7c2d12", "#ea580c", "#fb923c"],
  },
  {
    type: BackgroundType.SAKURA_DRIFT,
    name: "Cherry Blossom",
    description: "Soft twilight with gently falling cherry blossoms",
    icon: "🌸",
    // Cherry blossom: soft pinks and magentas
    themeColors: ["#831843", "#db2777", "#f9a8d4"],
  },
  {
    type: BackgroundType.FIREFLY_FOREST,
    name: "Firefly Forest",
    description: "Glowing fireflies drifting through a magical forest",
    icon: "🌲",
    // Forest: deep greens with yellow-green glow
    themeColors: ["#0d3320", "#166534", "#22c55e", "#bef264"],
  },
  {
    type: BackgroundType.AUTUMN_DRIFT,
    name: "Autumn Drift",
    description: "Tumbling autumn leaves dancing in crisp wind gusts",
    icon: "🍂",
    // Autumn: warm golds, oranges, and deep reds
    themeColors: ["#92400e", "#d97706", "#dc2626", "#78350f"],
  },
  {
    type: BackgroundType.SOLID_COLOR,
    name: "Pure Black",
    description: "Classic solid black background",
    icon: '<i class="fas fa-circle"></i>',
    color: "#000000",
    // Pure black: neutral with subtle blue accent
    themeColors: ["#18181b", "#3f3f46", "#71717a"],
  },
  {
    type: BackgroundType.LINEAR_GRADIENT,
    name: "Modern",
    description: "Sleek dark gradient",
    icon: '<i class="fas fa-square"></i>',
    colors: ["#0d1117", "#161b22", "#21262d"],
    direction: 135,
  },
];

/**
 * Get background metadata by type
 */
export function getBackgroundConfig(
  type: BackgroundType
): BackgroundMetadata | undefined {
  return backgroundsConfig.find((bg) => bg.type === type);
}

/**
 * Get all available background types
 */
export function getAvailableBackgroundTypes(): BackgroundType[] {
  return backgroundsConfig.map((bg) => bg.type);
}
