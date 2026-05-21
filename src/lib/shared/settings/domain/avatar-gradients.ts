import { BackgroundType } from "@austencloud/backgrounds";

export interface GradientOption {
  id: string;
  name: string;
  gradient: string;
  family: string;
}

export interface ColorFamily {
  id: string;
  name: string;
  icon: string;
}

export const COLOR_FAMILIES: ColorFamily[] = [
  { id: "warm", name: "Warm", icon: "fa-fire" },
  { id: "cool", name: "Cool", icon: "fa-snowflake" },
  { id: "vibrant", name: "Vibrant", icon: "fa-rainbow" },
  { id: "earth", name: "Earth", icon: "fa-leaf" },
  { id: "dark", name: "Dark", icon: "fa-moon" },
];

export const ALL_GRADIENTS: GradientOption[] = [
  {
    id: "sunset",
    name: "Sunset",
    gradient: "linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%)",
    family: "warm",
  },
  {
    id: "ember",
    name: "Ember",
    gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fbbf24 100%)",
    family: "warm",
  },
  {
    id: "autumn",
    name: "Autumn",
    gradient: "linear-gradient(135deg, #92400e 0%, #dc2626 50%, #f59e0b 100%)",
    family: "warm",
  },
  {
    id: "coral",
    name: "Coral",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #fb7185 50%, #fda4af 100%)",
    family: "warm",
  },
  {
    id: "ocean",
    name: "Ocean",
    gradient: "linear-gradient(135deg, #0c4a6e 0%, #0891b2 50%, #22d3ee 100%)",
    family: "cool",
  },
  {
    id: "twilight",
    name: "Twilight",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #818cf8 100%)",
    family: "cool",
  },
  {
    id: "arctic",
    name: "Arctic",
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #93c5fd 100%)",
    family: "cool",
  },
  {
    id: "mint",
    name: "Mint",
    gradient: "linear-gradient(135deg, #064e3b 0%, #10b981 50%, #6ee7b7 100%)",
    family: "cool",
  },
  {
    id: "rainbow",
    name: "Rainbow",
    gradient:
      "linear-gradient(135deg, #ef4444 0%, #f59e0b 20%, #22c55e 40%, #3b82f6 60%, #8b5cf6 80%, #ec4899 100%)",
    family: "vibrant",
  },
  {
    id: "neon",
    name: "Neon",
    gradient:
      "linear-gradient(135deg, #f472b6 0%, #c084fc 33%, #60a5fa 66%, #34d399 100%)",
    family: "vibrant",
  },
  {
    id: "aurora",
    name: "Aurora",
    gradient:
      "linear-gradient(135deg, #0f766e 0%, #22d3ee 25%, #a78bfa 50%, #f472b6 75%, #fbbf24 100%)",
    family: "vibrant",
  },
  {
    id: "cosmic",
    name: "Cosmic",
    gradient:
      "linear-gradient(135deg, #1e1b4b 0%, #7c3aed 30%, #ec4899 60%, #fbbf24 100%)",
    family: "vibrant",
  },
  {
    id: "forest",
    name: "Forest",
    gradient: "linear-gradient(135deg, #0d3320 0%, #166534 50%, #84cc16 100%)",
    family: "earth",
  },
  {
    id: "blossom",
    name: "Blossom",
    gradient: "linear-gradient(135deg, #831843 0%, #db2777 50%, #fbcfe8 100%)",
    family: "earth",
  },
  {
    id: "lavender",
    name: "Lavender",
    gradient: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 50%, #ddd6fe 100%)",
    family: "earth",
  },
  {
    id: "sand",
    name: "Sand",
    gradient: "linear-gradient(135deg, #78350f 0%, #a16207 50%, #84cc16 100%)",
    family: "earth",
  },
  {
    id: "midnight",
    name: "Midnight",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #3b82f6 100%)",
    family: "dark",
  },
  {
    id: "void",
    name: "Void",
    gradient: "linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #a855f7 100%)",
    family: "dark",
  },
  {
    id: "shadow",
    name: "Shadow",
    gradient: "linear-gradient(135deg, #1c1917 0%, #44403c 50%, #78716c 100%)",
    family: "dark",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    gradient: "linear-gradient(135deg, #0c0a09 0%, #292524 40%, #dc2626 100%)",
    family: "dark",
  },
  {
    id: "celestial",
    name: "Celestial",
    gradient: "linear-gradient(135deg, #0a1a4a 0%, #b89050 50%, #ffd080 100%)",
    family: "warm",
  },
  {
    id: "void",
    name: "Void",
    gradient: "linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)",
    family: "dark",
  },
];

export const THEME_TO_FAMILY: Partial<Record<BackgroundType, string>> = {
  [BackgroundType.PRIDE]: "vibrant",
  [BackgroundType.WINTER]: "cool",
  [BackgroundType.COSMIC]: "cool",
  [BackgroundType.OCEAN]: "cool",
  [BackgroundType.EMBER]: "warm",
  [BackgroundType.BLOSSOM]: "earth",
  [BackgroundType.FOREST]: "earth",
  [BackgroundType.AUTUMN]: "warm",
  [BackgroundType.CELESTIAL]: "warm",
  [BackgroundType.VOID]: "dark",
};

export const THEME_TO_GRADIENT: Partial<Record<BackgroundType, string>> = {
  [BackgroundType.PRIDE]: "rainbow",
  [BackgroundType.WINTER]: "arctic",
  [BackgroundType.COSMIC]: "twilight",
  [BackgroundType.OCEAN]: "ocean",
  [BackgroundType.EMBER]: "ember",
  [BackgroundType.BLOSSOM]: "blossom",
  [BackgroundType.FOREST]: "forest",
  [BackgroundType.AUTUMN]: "autumn",
  [BackgroundType.CELESTIAL]: "celestial",
  [BackgroundType.VOID]: "void",
};

export function getGradientsByFamily(familyId: string): GradientOption[] {
  return ALL_GRADIENTS.filter((g) => g.family === familyId);
}

export function getGradientById(id: string): GradientOption | undefined {
  return ALL_GRADIENTS.find((g) => g.id === id);
}

export function getDefaultGradientForTheme(
  backgroundType: BackgroundType
): GradientOption {
  const gradientId = THEME_TO_GRADIENT[backgroundType] ?? "twilight";
  return getGradientById(gradientId) ?? ALL_GRADIENTS[0]!;
}

export function getGradientAccentColor(gradient: string): string {
  const hexColors = gradient.match(/#[0-9a-fA-F]{6}/g) ?? [];
  if (hexColors.length === 0) return "#6366f1"; 

  const middleIndex = Math.floor(hexColors.length / 2);
  return hexColors[middleIndex] ?? hexColors[0] ?? "#6366f1";
}
