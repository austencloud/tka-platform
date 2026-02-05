/**
 * Panel Design Tokens
 * TypeScript constants for the panel design system
 * Use these when you need programmatic access to design values
 */

export const PanelBackgrounds = {
  default:
    "linear-gradient(135deg, rgba(20, 25, 35, 0.98) 0%, rgba(15, 20, 30, 0.95) 100%)",
  glass: "rgba(20, 25, 35, 0.75)",
  ocean: "linear-gradient(135deg, #0a0f1a 0%, #050810 100%)",
  aurora:
    "linear-gradient(135deg, rgba(30, 25, 45, 0.95) 0%, rgba(15, 20, 35, 0.95) 100%)",
  solid: "#14191f",
  elevated: "linear-gradient(135deg, #1a1f2e 0%, #12161f 100%)",
} as const;

export const PanelBorders = {
  subtle: "1px solid rgba(255, 255, 255, 0.1)",
  medium: "1px solid rgba(255, 255, 255, 0.15)",
  accentBlue: "1px solid rgba(59, 130, 246, 0.3)",
  accentPurple: "1px solid rgba(139, 92, 246, 0.25)",
  glow: "1px solid rgba(139, 92, 246, 0.4)",
} as const;

export const PanelShadows = {
  default:
    "0 -8px 32px rgba(0, 0, 0, 0.5), 0 -2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
  soft: "0 4px 16px rgba(0, 0, 0, 0.2)",
  dramatic: "0 16px 48px rgba(0, 0, 0, 0.7), 0 4px 12px rgba(0, 0, 0, 0.4)",
  ambientBlue:
    "0 0 60px rgba(59, 130, 246, 0.15), 0 8px 32px rgba(0, 0, 0, 0.6)",
  ambientPurple:
    "0 0 40px rgba(139, 92, 246, 0.12), 0 8px 32px rgba(0, 0, 0, 0.5)",
  glass: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 40px rgba(59, 130, 246, 0.1)",
} as const;

export const ButtonStyles = {
  primary: {
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    backgroundHover: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
    shadow: "0 4px 16px rgba(59, 130, 246, 0.3)",
    shadowHover: "0 6px 20px rgba(59, 130, 246, 0.4)",
  },
  secondary: {
    background: "rgba(255, 255, 255, 0.1)",
    backgroundHover: "rgba(255, 255, 255, 0.15)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },
  danger: {
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    backgroundHover: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
    shadow: "0 4px 16px rgba(239, 68, 68, 0.3)",
  },
} as const;

export const Spacing = {
  panelPadding: "24px",
  panelPaddingMobile: "16px",
  panelGap: "20px",
  panelGapMobile: "16px",
  sectionGap: "16px",
  contentGap: "12px",
} as const;

export const Typography = {
  panelTitle: {
    size: "20px",
    weight: 700,
    color: "rgba(255, 255, 255, 0.95)",
  },
  panelSubtitle: {
    size: "13px",
    color: "rgba(255, 255, 255, 0.6)",
  },
  sectionTitle: {
    size: "16px",
    weight: 600,
  },
  textPrimary: "rgba(255, 255, 255, 0.95)",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
} as const;

export const Transitions = {
  fast: "0.15s ease",
  normal: "0.2s ease",
  smooth: "0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const ZIndex = {
  panelBackdrop: 40,
  panelContent: 50,
  panelHeader: 51,
  modal: 100,
  toast: 1000,
} as const;

/**
 * Design presets - complete panel themes
 * Apply these for consistent panel styling
 */
export const PanelThemes = {
  default: {
    background: PanelBackgrounds.default,
    border: PanelBorders.subtle,
    shadow: PanelShadows.default,
    backdropFilter: "none",
  },
  glass: {
    background: PanelBackgrounds.glass,
    border: PanelBorders.medium,
    shadow: PanelShadows.glass,
    backdropFilter: "blur(20px)",
  },
  ocean: {
    background: PanelBackgrounds.ocean,
    border: PanelBorders.accentBlue,
    shadow: PanelShadows.ambientBlue,
    backdropFilter: "none",
  },
  aurora: {
    background: PanelBackgrounds.aurora,
    border: PanelBorders.accentPurple,
    shadow: PanelShadows.ambientPurple,
    backdropFilter: "none",
  },
  elevated: {
    background: PanelBackgrounds.elevated,
    border: PanelBorders.medium,
    shadow: PanelShadows.dramatic,
    backdropFilter: "none",
  },
} as const;

export type PanelTheme = keyof typeof PanelThemes;

/**
 * Helper function to get complete panel styles
 */
export function getPanelTheme(theme: PanelTheme = "default") {
  return PanelThemes[theme];
}
