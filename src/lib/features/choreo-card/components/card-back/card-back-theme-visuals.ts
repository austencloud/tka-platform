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
  /** Metallic gradient for "The Kinetic Alphabet" brand text */
  brandGradient: string;
  /** Metallic gradient for "CHOREO CARDS" sub text */
  brandSubGradient: string;
  /** Color for ornament diamond and lines */
  ornamentColor: string;
  /** Ornament line gradient endpoints (high opacity → transparent) */
  ornamentLineColor: string;
  /** Brand title font style: "italic-serif" (default) | "uppercase-sans" | "small-caps" */
  brandStyle?: "italic-serif" | "uppercase-sans" | "small-caps";
  /** Ornament between brand lines: "diamond" (default) | "triple-dot" | "star" | "none" | "double-line" */
  ornamentType?: "diamond" | "triple-dot" | "star" | "none" | "double-line";
  /** Border frame thickness in cqi: default 2 */
  borderWidth?: number;
  /** Drop-shadow glow behind brand text */
  brandGlow?: string;
  /** Opacity multiplier for CardBackDecorations (0 = hidden, 1 = default) */
  decorationOpacity?: number;
  /** Primary text color override (default: #ffffff) */
  textColor?: string;
  /** Muted text color override (default: rgba(255,255,255,0.75)) */
  textMutedColor?: string;
}

// Metallic effect: sharp white/silver highlights between color stops
// create the illusion of light catching a metal surface.
const THEMES: Record<string, CardBackThemeVisuals> = {
  cosmic: {
    borderGradient: "linear-gradient(135deg, #0f172a 0%, #312e81 15%, #c7d2fe 30%, #e0e7ff 50%, #c7d2fe 70%, #312e81 85%, #0f172a 100%)",
    accentColor: "#a5b4fc",
    background: "linear-gradient(180deg, #12122e 0%, #181840 35%, #1e1e50 55%, #181840 80%, #12122e 100%)",
    brandGradient: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(199,210,254,0.92) 35%, rgba(255,255,255,0.98) 50%, rgba(165,180,252,0.82) 100%)",
    brandSubGradient: "linear-gradient(180deg, rgba(199,210,254,0.85) 0%, rgba(165,180,252,0.7) 50%, rgba(199,210,254,0.85) 100%)",
    ornamentColor: "rgba(199,210,254,0.8)",
    ornamentLineColor: "rgba(165,180,252,0.6)",
    borderWidth: 1.8,
    brandGlow: "drop-shadow(0 0 3cqi rgba(165, 180, 252, 0.25))",
    decorationOpacity: 1.5,
  },
  ocean: {
    borderGradient: "linear-gradient(135deg, #0c4a6e 0%, #0891b2 20%, #a5f3fc 38%, #22d3ee 50%, #a5f3fc 62%, #0891b2 80%, #0c4a6e 100%)",
    accentColor: "#22d3ee",
    background: "linear-gradient(180deg, #0a2538 0%, #0e2d45 40%, #122f4a 70%, #0a2035 100%)",
    brandGradient: "linear-gradient(180deg, rgba(165,243,252,0.95) 0%, rgba(34,211,238,0.7) 40%, rgba(224,242,254,0.95) 50%, rgba(8,145,178,0.65) 100%)",
    brandSubGradient: "linear-gradient(180deg, rgba(165,243,252,0.8) 0%, rgba(34,211,238,0.65) 50%, rgba(165,243,252,0.8) 100%)",
    ornamentColor: "rgba(34,211,238,0.75)",
    ornamentLineColor: "rgba(34,211,238,0.55)",
  },
  winter: {
    borderGradient: "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 20%, #dbeafe 38%, #93c5fd 50%, #dbeafe 62%, #3b82f6 80%, #1e3a5f 100%)",
    accentColor: "#93c5fd",
    background: "linear-gradient(180deg, #141e32 0%, #1e2f50 40%, #1a3868 70%, #0e1e38 100%)",
    brandGradient: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(147,197,253,0.8) 40%, rgba(255,255,255,0.98) 50%, rgba(219,234,254,0.7) 100%)",
    brandSubGradient: "linear-gradient(180deg, rgba(219,234,254,0.8) 0%, rgba(147,197,253,0.65) 50%, rgba(219,234,254,0.8) 100%)",
    ornamentColor: "rgba(219,234,254,0.75)",
    ornamentLineColor: "rgba(147,197,253,0.55)",
  },
  ember: {
    borderGradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 18%, #fde68a 35%, #fb923c 50%, #fde68a 65%, #ea580c 82%, #7c2d12 100%)",
    accentColor: "#fb923c",
    background: "linear-gradient(180deg, #1f1210 0%, #2a1815 30%, #3d2218 60%, #2a1815 100%)",
    brandGradient: "linear-gradient(180deg, rgba(253,230,138,0.95) 0%, rgba(251,146,60,0.8) 40%, rgba(253,230,138,0.95) 50%, rgba(180,83,9,0.7) 100%)",
    brandSubGradient: "linear-gradient(180deg, rgba(253,230,138,0.8) 0%, rgba(251,146,60,0.6) 50%, rgba(253,230,138,0.8) 100%)",
    ornamentColor: "rgba(253,230,138,0.8)",
    ornamentLineColor: "rgba(251,146,60,0.6)",
  },
  blossom: {
    borderGradient: "linear-gradient(135deg, #831843 0%, #db2777 20%, #fce7f3 38%, #f9a8d4 50%, #fce7f3 62%, #db2777 80%, #831843 100%)",
    accentColor: "#f9a8d4",
    background: "linear-gradient(180deg, #281520 0%, #381f2e 40%, #281520 100%)",
    brandGradient: "linear-gradient(180deg, rgba(252,231,243,0.95) 0%, rgba(249,168,212,0.8) 40%, rgba(252,231,243,0.95) 50%, rgba(219,39,119,0.6) 100%)",
    brandSubGradient: "linear-gradient(180deg, rgba(252,231,243,0.8) 0%, rgba(249,168,212,0.6) 50%, rgba(252,231,243,0.8) 100%)",
    ornamentColor: "rgba(249,168,212,0.8)",
    ornamentLineColor: "rgba(249,168,212,0.6)",
  },
  forest: {
    borderGradient: "linear-gradient(135deg, #0d3320 0%, #166534 20%, #bbf7d0 38%, #22c55e 50%, #bbf7d0 62%, #166534 80%, #0d3320 100%)",
    accentColor: "#22c55e",
    background: "linear-gradient(180deg, #141e22 0%, #152820 50%, #183022 80%, #152820 100%)",
    brandGradient: "linear-gradient(180deg, rgba(187,247,208,0.95) 0%, rgba(34,197,94,0.75) 40%, rgba(220,252,231,0.95) 50%, rgba(22,101,52,0.65) 100%)",
    brandSubGradient: "linear-gradient(180deg, rgba(187,247,208,0.8) 0%, rgba(34,197,94,0.6) 50%, rgba(187,247,208,0.8) 100%)",
    ornamentColor: "rgba(34,197,94,0.75)",
    ornamentLineColor: "rgba(34,197,94,0.55)",
  },
  autumn: {
    borderGradient: "linear-gradient(135deg, #78350f 0%, #d97706 18%, #fef3c7 33%, #dc2626 50%, #fef3c7 67%, #d97706 82%, #78350f 100%)",
    accentColor: "#d97706",
    background: "linear-gradient(180deg, #252028 0%, #382a30 30%, #483528 60%, #352518 100%)",
    brandGradient: "linear-gradient(180deg, rgba(254,243,199,0.95) 0%, rgba(217,119,6,0.8) 40%, rgba(254,243,199,0.95) 50%, rgba(120,53,15,0.7) 100%)",
    brandSubGradient: "linear-gradient(180deg, rgba(254,243,199,0.8) 0%, rgba(217,119,6,0.6) 50%, rgba(254,243,199,0.8) 100%)",
    ornamentColor: "rgba(217,119,6,0.8)",
    ornamentLineColor: "rgba(217,119,6,0.6)",
  },
  rainbow: {
    borderGradient: "linear-gradient(135deg, #ff0000 0%, #ff6666 8%, #ff8000 14%, #ffcc66 22%, #ffff00 28%, #ffffaa 36%, #00ff00 42%, #66ff99 50%, #0080ff 56%, #66b3ff 64%, #8000ff 70%, #cc99ff 78%, #ff0080 85%, #ff66b3 92%, #ff0000 100%)",
    accentColor: "#f43f5e",
    background: "linear-gradient(135deg, rgba(255,0,0,0.15) 0%, rgba(255,128,0,0.12) 14%, rgba(255,255,0,0.1) 28%, rgba(0,255,0,0.12) 42%, rgba(0,128,255,0.15) 56%, rgba(128,0,255,0.12) 70%, rgba(255,0,128,0.1) 85%, rgba(255,0,0,0.12) 100%), linear-gradient(180deg, #161625 0%, #1e1e30 50%, #181828 100%)",
    brandGradient: "linear-gradient(90deg, rgba(255,100,100,0.9) 0%, rgba(255,200,100,0.9) 20%, rgba(255,255,150,0.95) 35%, rgba(100,255,150,0.9) 50%, rgba(100,180,255,0.9) 65%, rgba(200,150,255,0.9) 80%, rgba(255,100,180,0.9) 100%)",
    brandSubGradient: "linear-gradient(90deg, rgba(255,100,100,0.7) 0%, rgba(255,200,100,0.7) 20%, rgba(255,255,150,0.75) 35%, rgba(100,255,150,0.7) 50%, rgba(100,180,255,0.7) 65%, rgba(200,150,255,0.7) 80%, rgba(255,100,180,0.7) 100%)",
    ornamentColor: "rgba(255,255,255,0.75)",
    ornamentLineColor: "rgba(255,255,255,0.55)",
  },
};

export function getDarkThemeVisuals(backgroundType: string | undefined): CardBackThemeVisuals {
  return (backgroundType ? THEMES[backgroundType] : undefined) ?? THEMES.cosmic!;
}

export function getCardBackThemeVisuals(backgroundType: string | undefined): CardBackThemeVisuals {
  return getProofModeVisuals(backgroundType);
}

const PROOF_ACCENTS: Record<string, string> = {
  cosmic: "#4338ca",
  ocean: "#0891b2",
  winter: "#3b82f6",
  ember: "#ea580c",
  blossom: "#db2777",
  forest: "#166534",
  autumn: "#d97706",
  rainbow: "#7c3aed",
};

const PROOF_BORDERS: Record<string, string> = {
  cosmic:  "linear-gradient(135deg, #1e1b4b 0%, #4338ca 20%, #a5b4fc 40%, #e0e7ff 55%, #a5b4fc 70%, #4338ca 85%, #1e1b4b 100%)",
  ocean:   "linear-gradient(135deg, #164e63 0%, #0891b2 20%, #67e8f9 40%, #cffafe 55%, #67e8f9 70%, #0891b2 85%, #164e63 100%)",
  winter:  "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 20%, #93c5fd 40%, #dbeafe 55%, #93c5fd 70%, #3b82f6 85%, #1e3a5f 100%)",
  ember:   "linear-gradient(135deg, #7c2d12 0%, #ea580c 20%, #fb923c 40%, #fde68a 55%, #fb923c 70%, #ea580c 85%, #7c2d12 100%)",
  blossom: "linear-gradient(135deg, #831843 0%, #db2777 20%, #f9a8d4 40%, #fce7f3 55%, #f9a8d4 70%, #db2777 85%, #831843 100%)",
  forest:  "linear-gradient(135deg, #0d3320 0%, #166534 20%, #4ade80 40%, #bbf7d0 55%, #4ade80 70%, #166534 85%, #0d3320 100%)",
  autumn:  "linear-gradient(135deg, #78350f 0%, #d97706 20%, #fbbf24 40%, #fef3c7 55%, #fbbf24 70%, #d97706 85%, #78350f 100%)",
  rainbow: "linear-gradient(to top, #cc0000 0%, #cc6600 14%, #cccc00 28%, #00cc00 42%, #00cc66 56%, #0066cc 70%, #0033cc 82%, #6600cc 100%)",
};

export function getProofModeVisuals(backgroundType: string | undefined): CardBackThemeVisuals {
  const theme = backgroundType ?? "cosmic";
  const accent = PROOF_ACCENTS[theme] ?? "#4338ca";
  const base = getDarkThemeVisuals(theme);

  const isRainbow = theme === "rainbow";
  return {
    ...base,
    borderGradient: PROOF_BORDERS[theme] ?? PROOF_BORDERS.cosmic!,
    background: "linear-gradient(180deg, #ffffff 0%, #f8f9fc 50%, #ffffff 100%)",
    brandGradient: isRainbow
      ? "linear-gradient(90deg, #cc0000 0%, #cc6600 20%, #999900 35%, #009900 50%, #0066cc 65%, #6600cc 80%, #cc0066 100%)"
      : `linear-gradient(180deg, ${accent} 0%, ${accent}dd 50%, ${accent} 100%)`,
    brandSubGradient: isRainbow
      ? "linear-gradient(90deg, #cc000099 0%, #cc660099 20%, #99990099 35%, #00990099 50%, #0066cc99 65%, #6600cc99 80%, #cc006699 100%)"
      : `linear-gradient(180deg, ${accent}bb 0%, ${accent}88 50%, ${accent}bb 100%)`,
    ornamentColor: isRainbow ? "rgba(100, 100, 120, 0.7)" : `${accent}cc`,
    ornamentLineColor: isRainbow ? "rgba(100, 100, 120, 0.45)" : `${accent}77`,
    accentColor: isRainbow ? "#cc0000" : accent,
    brandGlow: "none",
    borderWidth: 3.5,
    decorationOpacity: 0,
    textColor: "#111111",
    textMutedColor: "rgba(0, 0, 0, 0.55)",
  };
}
