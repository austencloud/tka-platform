/**
 * Section color palette for visual differentiation in section-based labeling
 *
 * Uses CSS custom properties via color-mix() for theme consistency.
 * These strings are applied as inline styles, so var() references resolve at runtime.
 */

export const SECTION_COLORS = [
  { bg: "color-mix(in srgb, var(--semantic-info) 35%, transparent)", border: "color-mix(in srgb, var(--semantic-info) 80%, transparent)" }, // Blue
  { bg: "color-mix(in srgb, var(--feature-edit) 35%, transparent)", border: "color-mix(in srgb, var(--feature-edit) 80%, transparent)" }, // Purple
  { bg: "color-mix(in srgb, var(--semantic-success) 35%, transparent)", border: "color-mix(in srgb, var(--semantic-success) 80%, transparent)" }, // Green
  { bg: "color-mix(in srgb, var(--feature-generate) 35%, transparent)", border: "color-mix(in srgb, var(--feature-generate) 80%, transparent)" }, // Orange
  { bg: "color-mix(in srgb, var(--accent-pink) 35%, transparent)", border: "color-mix(in srgb, var(--accent-pink) 80%, transparent)" }, // Pink
  { bg: "color-mix(in srgb, var(--accent-teal) 35%, transparent)", border: "color-mix(in srgb, var(--accent-teal) 80%, transparent)" }, // Teal
] as const;
