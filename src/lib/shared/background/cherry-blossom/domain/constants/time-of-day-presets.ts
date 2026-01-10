/**
 * Time of Day Presets for Cherry Blossom Background
 *
 * Three distinct moods with matching gradients, petal colors, and default layers.
 */

export type TimeOfDay = "twilight" | "goldenHour" | "night";

export interface GradientStop {
  position: number;
  color: string;
}

export interface PetalColorPreset {
  r: number;
  rRange?: number;
  gMin: number;
  gMax: number;
  bMin?: number;
  bMax?: number;
  b?: number;
  probability?: number;
}

export interface TimeOfDayPreset {
  id: TimeOfDay;
  name: string;
  description: string;
  gradient: GradientStop[];
  /** Theme colors for UI accent derivation */
  themeColors: string[];
  /** Flower color palette for this time of day */
  flowerColors: {
    primary: PetalColorPreset;
    secondary: PetalColorPreset;
    accent: PetalColorPreset;
  };
  /** Petal color palette for this time of day */
  petalColors: {
    primary: PetalColorPreset;
    secondary: PetalColorPreset;
    accent: PetalColorPreset;
    highlight: PetalColorPreset;
  };
  /** Layers enabled by default for this mode */
  defaultLayers: {
    gradient: boolean;
    petals: boolean;
    petalsFar: boolean;
    petalsMid: boolean;
    petalsNear: boolean;
    moon: boolean;
    stars: boolean;
    trees: boolean;
    lanterns: boolean;
    trails: boolean;
    accumulation: boolean;
    vortex: boolean;
    reflection: boolean;
  };
}

/**
 * Twilight Preset
 * Soft purple-lavender gradient with classic pink cherry blossoms
 * Peaceful, contemplative mood
 */
export const TWILIGHT_PRESET: TimeOfDayPreset = {
  id: "twilight",
  name: "Twilight",
  description: "Peaceful dusk with soft lavender skies",
  gradient: [
    { position: 0, color: "#2a1f2e" }, // Dark purple
    { position: 0.3, color: "#3d2f42" }, // Medium purple
    { position: 0.6, color: "#4a3d52" }, // Soft lavender
    { position: 1, color: "#362d40" }, // Dark lavender
  ],
  themeColors: ["#831843", "#db2777", "#f9a8d4"],
  flowerColors: {
    primary: { r: 255, gMin: 100, gMax: 150, bMin: 180, bMax: 220 },
    secondary: { r: 255, gMin: 150, gMax: 190, bMin: 190, bMax: 220 },
    accent: { r: 255, gMin: 200, gMax: 230, bMin: 210, bMax: 240 },
  },
  petalColors: {
    primary: { r: 255, gMin: 140, gMax: 180, bMin: 170, bMax: 200 },
    secondary: { r: 255, gMin: 190, gMax: 220, bMin: 210, bMax: 240 },
    accent: { r: 255, gMin: 240, gMax: 255, bMin: 245, bMax: 255 },
    highlight: { r: 245, rRange: 10, gMin: 200, gMax: 225, b: 255 },
  },
  defaultLayers: {
    gradient: true,
    petals: true,
    petalsFar: true,
    petalsMid: true,
    petalsNear: true,
    moon: false,
    stars: false,
    trees: false,
    lanterns: false,
    trails: false,
    accumulation: false,
    vortex: false,
    reflection: false,
  },
};

/**
 * Golden Hour Preset
 * Warm orange-pink-gold gradient with sun-kissed petals
 * Nostalgic, warm mood
 */
export const GOLDEN_HOUR_PRESET: TimeOfDayPreset = {
  id: "goldenHour",
  name: "Golden Hour",
  description: "Warm sunset glow through cherry branches",
  gradient: [
    { position: 0, color: "#1a0a0a" }, // Deep burgundy-black
    { position: 0.25, color: "#4a1a1a" }, // Dark warm red
    { position: 0.5, color: "#8b4513" }, // Saddle brown / warm orange
    { position: 0.75, color: "#cd853f" }, // Peru / golden tan
    { position: 1, color: "#daa520" }, // Goldenrod glow at horizon
  ],
  themeColors: ["#c2410c", "#ea580c", "#fdba74"],
  flowerColors: {
    // Warmer toned flowers - coral and peach
    primary: { r: 255, gMin: 120, gMax: 160, bMin: 130, bMax: 160 },
    secondary: { r: 255, gMin: 170, gMax: 200, bMin: 150, bMax: 180 },
    accent: { r: 255, gMin: 210, gMax: 240, bMin: 180, bMax: 210 },
  },
  petalColors: {
    // Sun-kissed warm pinks and peaches
    primary: { r: 255, gMin: 150, gMax: 190, bMin: 140, bMax: 170 },
    secondary: { r: 255, gMin: 200, gMax: 230, bMin: 170, bMax: 200 },
    accent: { r: 255, gMin: 230, gMax: 250, bMin: 200, bMax: 220 },
    highlight: { r: 255, gMin: 240, gMax: 255, bMin: 220, bMax: 240 },
  },
  defaultLayers: {
    gradient: true,
    petals: true,
    petalsFar: true,
    petalsMid: true,
    petalsNear: true,
    moon: false,
    stars: false,
    trees: true, // Silhouettes against golden sky
    lanterns: false,
    trails: false,
    accumulation: false,
    vortex: false,
    reflection: false,
  },
};

/**
 * Night Preset
 * Deep blue-purple gradient with moonlit petals
 * Magical, festival atmosphere
 */
export const NIGHT_PRESET: TimeOfDayPreset = {
  id: "night",
  name: "Night",
  description: "Moonlit festival with glowing lanterns",
  gradient: [
    { position: 0, color: "#0a0a1a" }, // Deep night blue
    { position: 0.3, color: "#0d1030" }, // Dark indigo
    { position: 0.6, color: "#1a1a40" }, // Medium deep blue
    { position: 0.85, color: "#252550" }, // Soft indigo
    { position: 1, color: "#1a1a35" }, // Dark blue-purple
  ],
  themeColors: ["#312e81", "#4f46e5", "#a78bfa"],
  flowerColors: {
    // Cooler moonlit flowers - silver-pink
    primary: { r: 240, rRange: 15, gMin: 130, gMax: 170, bMin: 190, bMax: 230 },
    secondary: { r: 250, rRange: 5, gMin: 180, gMax: 210, bMin: 210, bMax: 240 },
    accent: { r: 255, gMin: 220, gMax: 245, bMin: 230, bMax: 255 },
  },
  petalColors: {
    // Moonlit cool pinks and silver
    primary: { r: 235, rRange: 20, gMin: 160, gMax: 200, bMin: 200, bMax: 235 },
    secondary: { r: 248, rRange: 7, gMin: 200, gMax: 230, bMin: 220, bMax: 248 },
    accent: { r: 255, gMin: 235, gMax: 255, bMin: 240, bMax: 255 },
    highlight: { r: 230, rRange: 25, gMin: 215, gMax: 240, bMin: 245, bMax: 255 },
  },
  defaultLayers: {
    gradient: true,
    petals: true,
    petalsFar: true,
    petalsMid: true,
    petalsNear: true,
    moon: true, // Moon for night mode
    stars: true, // Stars for night mode
    trees: true, // Dark silhouettes
    lanterns: true, // Glowing paper lanterns
    trails: false,
    accumulation: false,
    vortex: false,
    reflection: true, // Water reflection of moon/lanterns
  },
};

/** All presets indexed by ID */
export const TIME_OF_DAY_PRESETS: Record<TimeOfDay, TimeOfDayPreset> = {
  twilight: TWILIGHT_PRESET,
  goldenHour: GOLDEN_HOUR_PRESET,
  night: NIGHT_PRESET,
};

/** Get preset by ID with fallback to twilight */
export function getTimeOfDayPreset(id: TimeOfDay): TimeOfDayPreset {
  return TIME_OF_DAY_PRESETS[id] ?? TWILIGHT_PRESET;
}

/** List of all available time-of-day modes */
export const TIME_OF_DAY_OPTIONS: TimeOfDay[] = ["twilight", "goldenHour", "night"];
