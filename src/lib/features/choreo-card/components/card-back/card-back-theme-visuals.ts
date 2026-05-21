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

// Metallic effect: sharp white/silver highlights between color stops
// create the illusion of light catching a metal surface.
const THEMES: Record<string, CardBackThemeVisuals> = {
  cosmic: {
    borderGradient: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 20%, #c4b5fd 35%, #818cf8 50%, #c4b5fd 65%, #4338ca 80%, #1e1b4b 100%)",
    accentColor: "#818cf8",
    // Rich gradient: deep indigo at top, hint of teal at the horizon, back to deep at bottom
    background: "linear-gradient(180deg, #080c24 0%, #0e1535 25%, #152050 45%, #1a2858 60%, #152545 75%, #0d1a38 90%, #0a1230 100%)",
  },
  ocean: {
    borderGradient: "linear-gradient(135deg, #0c4a6e 0%, #0891b2 20%, #a5f3fc 38%, #22d3ee 50%, #a5f3fc 62%, #0891b2 80%, #0c4a6e 100%)",
    accentColor: "#22d3ee",
    background: "linear-gradient(180deg, #001a2e 0%, #000c1e 40%, #001122 70%, #000511 100%)",
  },
  winter: {
    borderGradient: "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 20%, #dbeafe 38%, #93c5fd 50%, #dbeafe 62%, #3b82f6 80%, #1e3a5f 100%)",
    accentColor: "#93c5fd",
    background: "linear-gradient(180deg, #0a0e1a 0%, #16213e 40%, #0f3460 70%, #041426 100%)",
  },
  ember: {
    borderGradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 18%, #fde68a 35%, #fb923c 50%, #fde68a 65%, #ea580c 82%, #7c2d12 100%)",
    accentColor: "#fb923c",
    background: "linear-gradient(180deg, #0f0505 0%, #1a0a0a 30%, #2d1410 60%, #1a0a0a 100%)",
  },
  blossom: {
    borderGradient: "linear-gradient(135deg, #831843 0%, #db2777 20%, #fce7f3 38%, #f9a8d4 50%, #fce7f3 62%, #db2777 80%, #831843 100%)",
    accentColor: "#f9a8d4",
    background: "linear-gradient(180deg, #1a0a14 0%, #2a1520 40%, #1a0a14 100%)",
  },
  forest: {
    borderGradient: "linear-gradient(135deg, #0d3320 0%, #166534 20%, #bbf7d0 38%, #22c55e 50%, #bbf7d0 62%, #166534 80%, #0d3320 100%)",
    accentColor: "#22c55e",
    background: "linear-gradient(180deg, #0a0e18 0%, #0a1612 50%, #0c1a14 80%, #0a1810 100%)",
  },
  autumn: {
    borderGradient: "linear-gradient(135deg, #78350f 0%, #d97706 18%, #fef3c7 33%, #dc2626 50%, #fef3c7 67%, #d97706 82%, #78350f 100%)",
    accentColor: "#d97706",
    background: "linear-gradient(180deg, #1a1520 0%, #2d1f28 30%, #3d2a1f 60%, #2a1810 100%)",
  },
  pride: {
    // Metallic rainbow: bright white highlights between each color
    borderGradient: "linear-gradient(135deg, #ff0000 0%, #ff6666 8%, #ff8000 14%, #ffcc66 22%, #ffff00 28%, #ffffaa 36%, #00ff00 42%, #66ff99 50%, #0080ff 56%, #66b3ff 64%, #8000ff 70%, #cc99ff 78%, #ff0080 85%, #ff66b3 92%, #ff0000 100%)",
    accentColor: "#f43f5e",
    // Full diagonal rainbow shimmer across the card, not just the border
    background: "linear-gradient(135deg, rgba(255,0,0,0.12) 0%, rgba(255,128,0,0.1) 14%, rgba(255,255,0,0.08) 28%, rgba(0,255,0,0.1) 42%, rgba(0,128,255,0.12) 56%, rgba(128,0,255,0.1) 70%, rgba(255,0,128,0.08) 85%, rgba(255,0,0,0.1) 100%), linear-gradient(180deg, #0a0a15 0%, #12121f 50%, #0d0d18 100%)",
  },
};

export function getCardBackThemeVisuals(backgroundType: string | undefined): CardBackThemeVisuals {
  return (backgroundType ? THEMES[backgroundType] : undefined) ?? THEMES.cosmic!;
}
