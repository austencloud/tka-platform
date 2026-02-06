/**
 * Admin Theme
 *
 * Centralized design tokens for all admin components.
 * Update these values to change the look and feel of the entire admin interface.
 */

/**
 * Admin color palette
 */
export const ADMIN_COLORS = {
  // Primary colors
  primary: "#3b82f6", // Blue
  secondary: "#6b7280", // Gray
  success: "#10b981", // Green
  warning: "#f59e0b", // Amber
  danger: "#ef4444", // Red
  info: "#6366f1", // Indigo

  // Feature category colors
  module: "#8b5cf6", // Purple
  tab: "#3b82f6", // Blue
  capability: "#f59e0b", // Amber

  // Status colors
  enabled: "#10b981", // Green
  disabled: "#ef4444", // Red

  // Role colors (from ROLE_DISPLAY)
  roleUser: "#6b7280", // Gray
  rolePremium: "#f59e0b", // Amber
  roleTester: "#8b5cf6", // Purple
  roleAdmin: "#ef4444", // Red

  // Background shades
  bgOverlay: "rgba(0, 0, 0, 0.7)",
  bgPanel: "rgba(0, 0, 0, 0.2)",
  bgCard: "rgba(255, 255, 255, 0.03)",
  bgCardHover: "rgba(255, 255, 255, 0.08)",
  bgSelected: "rgba(59, 130, 246, 0.15)",

  // Border colors
  border: "rgba(255, 255, 255, 0.1)",
  borderHover: "rgba(255, 255, 255, 0.15)",
  borderFocus: "rgba(102, 126, 234, 0.5)",

  // Text colors
  textPrimary: "rgba(255, 255, 255, 0.95)",
  textSecondary: "rgba(255, 255, 255, 0.7)",
  textMuted: "rgba(255, 255, 255, 0.5)",
  textDisabled: "rgba(255, 255, 255, 0.3)",
} as const;

/**
 * Spacing scale (follows Tailwind convention)
 */
export const ADMIN_SPACING = {
  xs: "0.25rem", // 4px
  sm: "0.5rem", // 8px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 50px
} as const;

/**
 * Border radius scale
 */
export const ADMIN_RADIUS = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

/**
 * Typography scale
 */
export const ADMIN_TYPOGRAPHY = {
  fontSize: {
    xs: "0.75rem", // 12px
    sm: "0.875rem", // 14px
    base: "1rem", // 16px
    lg: "1.125rem", // 18px
    xl: "1.25rem", // 20px
    "2xl": "1.5rem", // 24px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

/**
 * Transition durations
 */
export const ADMIN_TRANSITIONS = {
  fast: "0.15s",
  base: "0.2s",
  slow: "0.3s",
  easing: "ease",
} as const;

/**
 * Z-index scale
 */
export const ADMIN_Z_INDEX = {
  dropdown: 100,
  sticky: 200,
  overlay: 900,
  modal: 1000,
  toast: 1100,
} as const;

/**
 * Breakpoints for responsive design
 */
export const ADMIN_BREAKPOINTS = {
  mobile: "768px",
  tablet: "1024px",
  desktop: "1280px",
} as const;

/**
 * Generate gradient background
 */
export function generateGradient(
  color1: string,
  color2: string,
  angle = 135
): string {
  return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
}

/**
 * Get color with opacity
 */
export function withOpacity(color: string, opacity: number): string {
  // If it's a hex color, convert to rgba
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  // If it's already rgba, replace the opacity
  if (color.startsWith("rgba")) {
    return color.replace(/[\d.]+\)$/g, `${opacity})`);
  }
  // Otherwise return as is
  return color;
}
