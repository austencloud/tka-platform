/**
 * Card Back Theme Visuals
 *
 * Gradient backgrounds and border colors for each theme.
 * Decorative SVG elements (fish, trees, snowflakes, etc.) are rendered
 * directly in CardBackDecorations.svelte as inline SVG for reliability.
 */

export interface CardBackThemeVisuals {
  /** CSS gradient for the border frame */
  borderGradient: string;
  /** CSS background for the inner card */
  background: string;
  /** Accent color for LOOP title */
  accentColor: string;
}

const THEMES: Record<string, CardBackThemeVisuals> = {
  nightSky: {
    borderGradient: "linear-gradient(135deg, #1e1b4b, #4338ca, #818cf8, #4338ca, #1e1b4b)",
    accentColor: "#818cf8",
    background: "linear-gradient(180deg, #0a0e2c 0%, #1a2040 40%, #0a0e2c 100%)",
  },
  deepOcean: {
    borderGradient: "linear-gradient(135deg, #0c4a6e, #0891b2, #22d3ee, #0891b2, #0c4a6e)",
    accentColor: "#22d3ee",
    background: "linear-gradient(180deg, #001a2e 0%, #000c1e 40%, #001122 70%, #000511 100%)",
  },
  snowfall: {
    borderGradient: "linear-gradient(135deg, #1e3a5f, #3b82f6, #93c5fd, #3b82f6, #1e3a5f)",
    accentColor: "#93c5fd",
    background: "linear-gradient(180deg, #0a0e1a 0%, #16213e 40%, #0f3460 70%, #041426 100%)",
  },
  emberGlow: {
    borderGradient: "linear-gradient(135deg, #7c2d12, #ea580c, #fb923c, #ea580c, #7c2d12)",
    accentColor: "#fb923c",
    background: "linear-gradient(180deg, #0f0505 0%, #1a0a0a 30%, #2d1410 60%, #1a0a0a 100%)",
  },
  sakuraDrift: {
    borderGradient: "linear-gradient(135deg, #831843, #db2777, #f9a8d4, #db2777, #831843)",
    accentColor: "#f9a8d4",
    background: "linear-gradient(180deg, #1a0a14 0%, #2a1520 40%, #1a0a14 100%)",
  },
  fireflyForest: {
    borderGradient: "linear-gradient(135deg, #0d3320, #166534, #22c55e, #166534, #0d3320)",
    accentColor: "#22c55e",
    background: "linear-gradient(180deg, #0a0e18 0%, #0a1612 50%, #0c1a14 80%, #0a1810 100%)",
  },
  autumnDrift: {
    borderGradient: "linear-gradient(135deg, #78350f, #d97706, #dc2626, #d97706, #78350f)",
    accentColor: "#d97706",
    background: "linear-gradient(180deg, #1a1520 0%, #2d1f28 30%, #3d2a1f 60%, #2a1810 100%)",
  },
  pride: {
    borderGradient: "linear-gradient(135deg, #ff0000, #ff8000, #ffff00, #00ff00, #0080ff, #8000ff, #ff0080, #ff0000)",
    accentColor: "#f43f5e",
    background: "linear-gradient(180deg, #0a0a15 0%, #12121f 50%, #0d0d18 100%)",
  },
  solidColor: {
    borderGradient: "linear-gradient(135deg, var(--theme-accent, #6366f1), var(--theme-stroke-strong, #444), var(--theme-accent, #6366f1))",
    accentColor: "var(--theme-accent, #6366f1)",
    background: "var(--theme-panel-bg, #18181b)",
  },
  linearGradient: {
    borderGradient: "linear-gradient(135deg, var(--theme-accent, #6366f1), var(--theme-stroke-strong, #444), var(--theme-accent, #6366f1))",
    accentColor: "var(--theme-accent, #6366f1)",
    background: "var(--theme-panel-bg, #18181b)",
  },
};

export function getCardBackThemeVisuals(backgroundType: string): CardBackThemeVisuals {
  return THEMES[backgroundType] ?? THEMES.nightSky!;
}
