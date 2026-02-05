/**
 * Theme Calculator (Landing - standalone)
 *
 * Simplified version of scribe's background-theme-calculator.
 * Applies CSS variables based on background type for the landing page.
 * All animated backgrounds are dark, so we only need the dark-mode branch.
 */

import { BackgroundType } from "@austencloud/backgrounds";

const BACKGROUND_THEME_COLORS: Record<string, string[]> = {
  [BackgroundType.PRIDE]: ["#8b1c1c", "#6b6b00", "#f43f5e", "#fda4af"],
  [BackgroundType.SNOWFALL]: ["#1e3a5f", "#3b82f6", "#93c5fd"],
  [BackgroundType.NIGHT_SKY]: ["#1e1b4b", "#4338ca", "#818cf8"],
  [BackgroundType.DEEP_OCEAN]: ["#0c4a6e", "#0891b2", "#22d3ee"],
  [BackgroundType.EMBER_GLOW]: ["#7c2d12", "#ea580c", "#fb923c"],
  [BackgroundType.SAKURA_DRIFT]: ["#831843", "#db2777", "#f9a8d4"],
  [BackgroundType.FIREFLY_FOREST]: ["#0d3320", "#166534", "#22c55e", "#bef264"],
  [BackgroundType.AUTUMN_DRIFT]: ["#92400e", "#d97706", "#dc2626", "#78350f"],
};

function extractAccentColor(colors: string[]): string {
  if (colors.length === 0) return "#818cf8";
  if (colors.length === 1) return colors[0]!;
  if (colors.length === 3) return colors[1]!;
  return colors[1] || colors[0]!;
}

export function applyThemeForBackground(backgroundType: BackgroundType): void {
  if (typeof document === "undefined") return;

  const themeColors = BACKGROUND_THEME_COLORS[backgroundType];
  if (!themeColors) return;

  const accent = extractAccentColor(themeColors);
  const root = document.documentElement;

  // Dark mode matte theme (all landing backgrounds are dark)
  root.style.setProperty("--theme-panel-bg", "rgba(0, 0, 0, 0.75)");
  root.style.setProperty("--theme-panel-elevated-bg", "rgba(0, 0, 0, 0.5)");
  root.style.setProperty("--theme-card-bg", "rgba(0, 0, 0, 0.75)");
  root.style.setProperty("--theme-card-hover-bg", "rgba(0, 0, 0, 0.55)");
  root.style.setProperty("--theme-accent", accent);
  root.style.setProperty("--theme-accent-strong", accent);
  root.style.setProperty("--theme-stroke", "rgba(255, 255, 255, 0.08)");
  root.style.setProperty("--theme-stroke-strong", "rgba(255, 255, 255, 0.14)");
  root.style.setProperty("--theme-text", "#ffffff");
  root.style.setProperty("--theme-text-dim", "rgba(255, 255, 255, 0.75)");
  root.style.setProperty("--theme-shadow", "0 14px 36px rgba(0, 0, 0, 0.4)");
}
